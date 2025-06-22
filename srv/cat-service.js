const cds = require('@sap/cds');
const SequenceHelper = require("./lib/SequenceHelper");
const FormData = require('form-data');
const { SELECT } = require('@sap/cds/lib/ql/cds-ql');
const MAX_RETRIES = 60;
const RETRY_DELAY_MS = 6000;
const { executeHttpRequest } = require("@sap-cloud-sdk/http-client");

class SalesCatalogService extends cds.ApplicationService {
    async init() {
        // Connect to all services at once
        const [db, s4HanaSales, s4HanaBP, DocumentExtraction_Dest] = await Promise.all([
            cds.connect.to("db"),
            cds.connect.to("API_SALES_ORDER_SRV"),
            cds.connect.to("API_BUSINESS_PARTNER"),
            cds.connect.to('DocumentExtraction_Dest')
        ]);

        // Store connections
        this.db = db;
        this.s4HanaSales = s4HanaSales;
        this.s4HanaBP = s4HanaBP;
        this.DocumentExtraction_Dest = DocumentExtraction_Dest;

        const { salesorder, SalesOrderItem, attachments } = this.entities;

        // Setup event handlers
        this.before("NEW", salesorder.drafts, async (req) => {
            const documentId = await new SequenceHelper({
                db: this.db,
                sequence: "ZSALES_DOCUMENT_ID",
                table: "zsalesorder_SalesOrderEntity",
                field: "documentId",
            }).getNextNumber();
            req.data.documentId = documentId.toString();
        });

        this.on('copySalesorder', async (req) => {
            const { ID } = req.params[0];
            const originalsalesorder = await db.run(
                SELECT.one.from(salesorder)
                    .columns(inv => {
                        inv`*`,                   // Select all columns from salesorder
                            inv.to_Item(int => { int`*` }) // Select all columns from salesorder Item
                    })
                    .where({ ID: ID })
            );

            if (!originalsalesorder) {
                const draftsalesorder = await db.run(
                    SELECT.one.from(salesorder.drafts)
                        .columns(inv => {
                            inv`*`,                   // Select all columns from salesorder
                                inv.to_Item(int => { int`*` }) // Select all columns from salesorder Item
                        })
                        .where({ ID: ID })
                );
                if (draftsalesorder) {
                    req.error(404, 'You cannot copy a Draft Order');
                }
                else {
                    req.error(404, 'Please contact SAP IT');
                }
                if (req.errors) { req.reject(); }
            }

            const copiedsalesorder = Object.assign({}, originalsalesorder);
            delete copiedsalesorder.ID;  // Remove the ID to ensure a new entity is created
            delete copiedsalesorder.createdAt;
            delete copiedsalesorder.createdBy;
            delete copiedsalesorder.modifiedAt;
            delete copiedsalesorder.modifiedBy;
            delete copiedsalesorder.HasActiveEntity;
            delete copiedsalesorder.HasDraftEntity;
            delete copiedsalesorder.IsActiveEntity;
            copiedsalesorder.DraftAdministrativeData_DraftUUID = cds.utils.uuid();
            // Ensure all related entities are copied
            if (originalsalesorder.to_Item) {
                copiedsalesorder.to_Item = originalsalesorder.to_Item.map(salesorderItem => {
                    const copiedsalesorderItem = Object.assign({}, salesorderItem);
                    delete copiedsalesorderItem.ID; // Remove the ID to create a new related entity
                    delete copiedsalesorderItem.up__ID;
                    delete copiedsalesorderItem.createdAt;
                    delete copiedsalesorderItem.createdBy;
                    delete copiedsalesorderItem.modifiedAt;
                    delete copiedsalesorderItem.modifiedBy;
                    copiedsalesorderItem.DraftAdministrativeData_DraftUUID = cds.utils.uuid();
                    return copiedsalesorderItem;
                });
            }
            //create a draft
            const osalesorder = await this.send({
                query: INSERT.into(salesorder).entries(copiedsalesorder),
                event: "NEW",
            });

            //return the draft
            if (!osalesorder) {
                req.notify("Copy failed");
            }
            else {
                req.notify("Order has been successfully copied and saved as a new draft.");
            }

        });

        this.before('SAVE', salesorder, async (req) => {

            if (req.data.mode === 'email') {

                const dms = await cds.connect.to('DocumentStore');

                try {
                    const folderResponse = await dms.get(
                        `/root?objectId=${req.data.dmsFolder}`
                    );

                    let attachments = [];
                    for (const obj of folderResponse.objects) {
                        const objectId = obj.object.properties["cmis:objectId"].value;
                        const mimeType = obj.object.properties["cmis:contentStreamMimeType"]?.value || "application/octet-stream";
                        const filename = obj.object.properties["cmis:contentStreamFileName"]?.value || "unknown";
                        ;

                        const destination = { destinationName: 'sap_process_automation_document_store' }
                        const url = `/root?cmisselector=content&objectId=${objectId}`;
                        const getResponse = await executeHttpRequest(
                            destination,
                            {
                                url,
                                method: "GET",
                                responseType: "arraybuffer",
                            }
                        );

                        let fileBuffer;
                        fileBuffer = Buffer.from(getResponse.data);

                        if (fileBuffer) {

                            attachments.push({
                                content: fileBuffer,
                                mimeType: mimeType,
                                filename: filename,
                                folderId: req.data.dmsFolder
                            });

                            // const extractionResults = await processFileBuffer(fileBuffer, req);
                            // Creating form data
                            const form = new FormData();
                            form.append('file', fileBuffer, filename || 'file', mimeType || 'application/octet-stream');
                            const options = {
                                schemaName: 'SAP_purchaseOrder_schema',
                                clientId: 'default',
                                documentType: 'Purchase Order',
                                receivedDate: new Date().toISOString().slice(0, 10),
                                enrichment: {
                                    sender: { top: 5, type: "businessEntity", subtype: "supplier" },
                                    employee: { type: "employee" }
                                }
                            };
                            form.append('options', JSON.stringify(options));
        
                            let status = '';
                            let extractionResults;
        
                            // Submit document for extraction with error handling
                            try {
                                const extractionResponse = await this.DocumentExtraction_Dest.send({
                                    method: 'POST',
                                    path: '/',
                                    data: form,
                                    headers: {
                                        'Content-Type': 'multipart/form-data',
                                        'Content-Length': form.getLengthSync()
                                    }
                                });
        
                                if (extractionResponse.status === 'PENDING') {
                                    // Poll for results
                                    let retries = 0;
                                    let jobDone = false;
        
                                    while (!jobDone && retries < MAX_RETRIES) {
                                        const jobStatus = await this.DocumentExtraction_Dest.get(`/${extractionResponse.id}`);
                                        console.log(`Attempt ${retries + 1}: Current job status is '${jobStatus.status}'`);
        
                                        if (jobStatus.status === "DONE") {
                                            jobDone = true;
                                            extractionResults = jobStatus.extraction;
                                        } else {
                                            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                                            retries++;
                                        }
                                    }
        
                                    if (!jobDone) {
                                        req.data.Status = `Extraction failed after ${MAX_RETRIES} attempts`;
                                        return;
                                    }
                                }
                            } catch (error) {
                                req.data.Status = `Document extraction failed: ${error.message}`;
                                return;
                            }
        
                            // Map extraction results
                            const headerFields = extractionResults.headerFields.reduce((acc, field) => {
                                acc[field.name] = field.value;
                                return acc;
                            }, {});
        
                            const lineItems = extractionResults.lineItems.map(item => {
                                return item.reduce((acc, field) => {
                                    acc[field.name] = field.value;
                                    return acc;
                                }, {});
                            });
        
                            const today = new Date();
                            const futureDate = new Date();
                            futureDate.setDate(today.getDate() + 10);
                            req.data.SalesOrderType = "OR";
                            req.data.SoldToParty = "29100001";
                            req.data.TransactionCurrency = headerFields.currencyCode;
                            req.data.SalesOrderDate = today.toISOString().split('T')[0];
                            req.data.RequestedDeliveryDate = futureDate.toISOString().split('T')[0];
                            req.data.to_Item = lineItems.map((lineItem, index) => ({
                                SalesOrderItem: (index + 1).toString().padStart(5, "0"),
                                Material: lineItem.customerMaterialNumber,
                                SalesOrderItemText: lineItem.description,
                                RequestedQuantity: lineItem.quantity,
                                RequestedQuantityUnit: "PC"
                            }));
        
                            try {
                                const payload = {
                                    SalesOrderType: req.data.SalesOrderType,
                                    // SalesOrganization: req.data.SalesOrganization,
                                    // DistributionChannel: req.data.DistributionChannel,
                                    // OrganizationDivision: req.data.OrganizationDivision,
                                    SoldToParty: req.data.SoldToParty,
                                    // PurchaseOrderByCustomer: req.data.PurchaseOrderByCustomer,
                                    TransactionCurrency: req.data.TransactionCurrency,
                                    SalesOrderDate: new Date(req.data.SalesOrderDate).toISOString(),
                                    // PricingDate: new Date(req.data.PricingDate).toISOString(),
                                    RequestedDeliveryDate: new Date(req.data.RequestedDeliveryDate).toISOString(),
                                    // ShippingCondition: req.data.ShippingCondition,
                                    // CompleteDeliveryIsDefined: req.data.CompleteDeliveryIsDefined ?? false,
                                    // IncotermsClassification: req.data.IncotermsClassification,
                                    // IncotermsLocation1: req.data.IncotermsLocation1,
                                    // CustomerPaymentTerms: req.data.CustomerPaymentTerms,
                                    to_Item: {
                                        results: req.data.to_Item.map(item => ({
                                            SalesOrderItem: item.SalesOrderItem,
                                            Material: item.Material,
                                            SalesOrderItemText: item.SalesOrderItemText,
                                            RequestedQuantity: item.RequestedQuantity,
                                            RequestedQuantityUnit: item.RequestedQuantityUnit,
                                            // ItemGrossWeight: item.ItemGrossWeight,
                                            // ItemNetWeight: item.ItemNetWeight,
                                            // ItemWeightUnit: item.ItemWeightUnit,
                                            // NetAmount: item.NetAmount,
                                            // MaterialGroup: item.MaterialGroup,
                                            // ProductionPlant: item.ProductionPlant,
                                            // StorageLocation: item.StorageLocation,
                                            // DeliveryGroup: item.DeliveryGroup,
                                            // ShippingPoint: item.ShippingPoint
                                        }))
                                    }
                                };
        
                                const response = await this.s4HanaSales.run(
                                    INSERT.into('A_SalesOrder').entries(payload)
                                );
        
                                console.log('S/4HANA response:', response);
                                req.data.SalesOrder = response.SalesOrder;
                                req.data.SalesOrganization = response.SalesOrganization;
                                req.data.Status = 'Sales Order Created';
                            } catch (error) {
                                console.error('Error posting to S/4HANA:', error.message);
                                req.error(500, 'Failed to create sales order in S/4HANA', error.message);
                            }

                        }
                    }
                    req.data.attachments = attachments; // NEED TO INSERT INTO DRAFTS AND DELETE FROM CURRENT DMS LOCATION.
                    req.data.createdBy = req.data.senderMail;
                    req.data.modifiedBy = req.data.senderMail;
                    //
                } catch (error) {
                    console.error('Document extraction failed:', error.message);
                    req.data.status = error.message;
                }

            }

            else if (!req.data.SalesOrderType) {

                const allRecords = await this.run(
                    SELECT.from(salesorder.drafts)
                        .columns(cpx => {
                            cpx`*`,
                                cpx.attachments(cfy => {
                                    cfy`content`,
                                        cfy`mimeType`,
                                        cfy`folderId`,
                                        cfy`url`
                                });
                        })
                        .where({
                            ID: req.data.ID
                        })
                );

                let fileBuffer;
                if (allRecords[0].attachments[0].content) {
                    try {
                        fileBuffer = await streamToBuffer(allRecords[0].attachments[0].content);
                    } catch (error) {
                        req.error(400, "Error converting stream to Base64");
                        if (req.errors) { req.reject(); }
                    }

                    //creating form data
                    const form = new FormData();
                    try {
                        form.append('file', fileBuffer, req.data.attachments[0].filename || 'file', req.data.attachments[0].mimeType || 'application/octet-stream');
                    } catch (error) {
                        req.data.Status = error.message;
                        req.error(400, error.message);
                        if (req.errors) { req.reject(); }
                    }

                    const options = {
                        schemaName: 'SAP_purchaseOrder_schema',
                        clientId: 'default',
                        documentType: 'Purchase Order',
                        receivedDate: new Date().toISOString().slice(0, 10),
                        enrichment: {
                            sender: { top: 5, type: "businessEntity", subtype: "supplier" },
                            employee: { type: "employee" }
                        }
                    };
                    form.append('options', JSON.stringify(options));

                    let status = '';
                    let extractionResults;

                    // Submit document for extraction with error handling
                    try {
                        const extractionResponse = await this.DocumentExtraction_Dest.send({
                            method: 'POST',
                            path: '/',
                            data: form,
                            headers: {
                                'Content-Type': 'multipart/form-data',
                                'Content-Length': form.getLengthSync()
                            }
                        });

                        if (extractionResponse.status === 'PENDING') {
                            // Poll for results
                            let retries = 0;
                            let jobDone = false;

                            while (!jobDone && retries < MAX_RETRIES) {
                                const jobStatus = await this.DocumentExtraction_Dest.get(`/${extractionResponse.id}`);
                                console.log(`Attempt ${retries + 1}: Current job status is '${jobStatus.status}'`);

                                if (jobStatus.status === "DONE") {
                                    jobDone = true;
                                    extractionResults = jobStatus.extraction;
                                } else {
                                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                                    retries++;
                                }
                            }

                            if (!jobDone) {
                                req.data.Status = `Extraction failed after ${MAX_RETRIES} attempts`;
                                return;
                            }
                        }
                    } catch (error) {
                        req.data.Status = `Document extraction failed: ${error.message}`;
                        return;
                    }

                    // Map extraction results
                    const headerFields = extractionResults.headerFields.reduce((acc, field) => {
                        acc[field.name] = field.value;
                        return acc;
                    }, {});

                    const lineItems = extractionResults.lineItems.map(item => {
                        return item.reduce((acc, field) => {
                            acc[field.name] = field.value;
                            return acc;
                        }, {});
                    });

                    const today = new Date();
                    const futureDate = new Date();
                    futureDate.setDate(today.getDate() + 10);
                    req.data.SalesOrderType = "OR";
                    req.data.SoldToParty = "29100001";
                    req.data.TransactionCurrency = headerFields.currencyCode;
                    req.data.SalesOrderDate = today.toISOString().split('T')[0];
                    req.data.RequestedDeliveryDate = futureDate.toISOString().split('T')[0];
                    req.data.to_Item = lineItems.map((lineItem, index) => ({
                        SalesOrderItem: (index + 1).toString().padStart(5, "0"),
                        Material: lineItem.customerMaterialNumber,
                        SalesOrderItemText: lineItem.description,
                        RequestedQuantity: lineItem.quantity,
                        RequestedQuantityUnit: "PC"
                    }));

                    try {
                        const payload = {
                            SalesOrderType: req.data.SalesOrderType,
                            // SalesOrganization: req.data.SalesOrganization,
                            // DistributionChannel: req.data.DistributionChannel,
                            // OrganizationDivision: req.data.OrganizationDivision,
                            SoldToParty: req.data.SoldToParty,
                            // PurchaseOrderByCustomer: req.data.PurchaseOrderByCustomer,
                            TransactionCurrency: req.data.TransactionCurrency,
                            SalesOrderDate: new Date(req.data.SalesOrderDate).toISOString(),
                            // PricingDate: new Date(req.data.PricingDate).toISOString(),
                            RequestedDeliveryDate: new Date(req.data.RequestedDeliveryDate).toISOString(),
                            // ShippingCondition: req.data.ShippingCondition,
                            // CompleteDeliveryIsDefined: req.data.CompleteDeliveryIsDefined ?? false,
                            // IncotermsClassification: req.data.IncotermsClassification,
                            // IncotermsLocation1: req.data.IncotermsLocation1,
                            // CustomerPaymentTerms: req.data.CustomerPaymentTerms,
                            to_Item: {
                                results: req.data.to_Item.map(item => ({
                                    SalesOrderItem: item.SalesOrderItem,
                                    Material: item.Material,
                                    SalesOrderItemText: item.SalesOrderItemText,
                                    RequestedQuantity: item.RequestedQuantity,
                                    RequestedQuantityUnit: item.RequestedQuantityUnit,
                                    // ItemGrossWeight: item.ItemGrossWeight,
                                    // ItemNetWeight: item.ItemNetWeight,
                                    // ItemWeightUnit: item.ItemWeightUnit,
                                    // NetAmount: item.NetAmount,
                                    // MaterialGroup: item.MaterialGroup,
                                    // ProductionPlant: item.ProductionPlant,
                                    // StorageLocation: item.StorageLocation,
                                    // DeliveryGroup: item.DeliveryGroup,
                                    // ShippingPoint: item.ShippingPoint
                                }))
                            }
                        };

                        const response = await this.s4HanaSales.run(
                            INSERT.into('A_SalesOrder').entries(payload)
                        );

                        console.log('S/4HANA response:', response);
                        req.data.SalesOrder = response.SalesOrder;
                        req.data.SalesOrganization = response.SalesOrganization;
                    } catch (error) {
                        console.error('Error posting to S/4HANA:', error.message);
                        req.error(500, 'Failed to create sales order in S/4HANA', error.message);
                    }

                    // const removeSpecialCharacters = (str) => {
                    //     if (!str) return str;
                    //     return str.replace(/[^a-zA-Z0-9\s]/g, '');
                    // };

                    // Separate BP lookups with error handling
                    // let soldToResponse = null;
                    // let shipToResponse = null;

                    // try {
                    //     soldToResponse = await this.s4HanaBP.run(
                    //         SELECT.one.from('A_BusinessPartnerAddress')
                    //             .where({
                    //                 StreetName: removeSpecialCharacters(headerFields.senderStreet),
                    //                 HouseNumber: removeSpecialCharacters(headerFields.senderHouseNumber),
                    //                 CityName: removeSpecialCharacters(headerFields.senderCity),
                    //                 PostalCode: removeSpecialCharacters(headerFields.senderPostalCode),
                    //                 Region: removeSpecialCharacters(headerFields.senderState)
                    //             })
                    //     );
                    // } catch (error) {
                    //     req.data.Status = `SoldTo BP lookup failed: ${error.message}`;
                    // }

                    // try {
                    //     shipToResponse = await this.s4HanaBP.run(
                    //         SELECT.one.from('A_BusinessPartnerAddress')
                    //             .where({
                    //                 // StreetName: removeSpecialCharacters(headerFields.shipToStreet),
                    //                 HouseNumber: headerFields.shipToHouseNumber,
                    //                 CityName: headerFields.shipToCity,
                    //                 PostalCode: headerFields.shipToPostalCode,
                    //                 Region: headerFields.shipToState,
                    //                 Country: headerFields.shipToCountryCode
                    //             })
                    //     );
                    // } catch (error) {
                    //     req.data.Status = `ShipTo BP lookup failed: ${error.message}`;
                    // }


                    // // Check if both BP lookups failed
                    // if (!soldToResponse && !shipToResponse) {
                    //     req.data.Status = 'Both Business Partner lookups failed';
                    //     // return;
                    // }

                    // Create S4HANA sales order
                    // const salesOrderPayload = {
                    //     SalesOrderType: 'OR',
                    //     SoldToParty: '1000294',//soldToResponse?.BusinessPartner || shipToResponse?.BusinessPartner,
                    //     TransactionCurrency: headerFields.currencyCode || '',
                    //     SalesOrderDate: new Date(headerFields.documentDate || Date.now()).toISOString(),
                    //     RequestedDeliveryDate: new Date(headerFields.requestedDeliveryDate || Date.now()).toISOString(),
                    //     to_Item: {
                    //         results: lineItems.map((item, index) => ({
                    //             SalesOrderItem: String((index + 1) * 10),
                    //             Material: item.customerMaterialNumber || '',
                    //             SalesOrderItemText: item.description || '',
                    //             RequestedQuantity: parseFloat(item.quantity) || 0
                    //         }))
                    //     }
                    // };

                    // try {
                    //     const s4Response = await this.s4HanaSales.run(
                    //         INSERT.into('A_SalesOrder').entries(salesOrderPayload)
                    //     );

                    //     console.log('S/4HANA response:', s4Response);
                    //     req.data.SalesOrder = s4Response.SalesOrder;

                    // } catch (error) {
                    //     req.data.Status = `S4HANA Sales Order creation failed: ${error.message}`;
                    //     // return;
                    // }

                }
            }

            else {
                try {
                    const payload = {
                        SalesOrderType: req.data.SalesOrderType,
                        // SalesOrganization: req.data.SalesOrganization,
                        // DistributionChannel: req.data.DistributionChannel,
                        // OrganizationDivision: req.data.OrganizationDivision,
                        SoldToParty: req.data.SoldToParty,
                        // PurchaseOrderByCustomer: req.data.PurchaseOrderByCustomer,
                        TransactionCurrency: req.data.TransactionCurrency,
                        SalesOrderDate: new Date(req.data.SalesOrderDate).toISOString(),
                        // PricingDate: new Date(req.data.PricingDate).toISOString(),
                        RequestedDeliveryDate: new Date(req.data.RequestedDeliveryDate).toISOString(),
                        // ShippingCondition: req.data.ShippingCondition,
                        // CompleteDeliveryIsDefined: req.data.CompleteDeliveryIsDefined ?? false,
                        // IncotermsClassification: req.data.IncotermsClassification,
                        // IncotermsLocation1: req.data.IncotermsLocation1,
                        // CustomerPaymentTerms: req.data.CustomerPaymentTerms,
                        to_Item: {
                            results: req.data.to_Item.map(item => ({
                                SalesOrderItem: item.SalesOrderItem,
                                Material: item.Material,
                                SalesOrderItemText: item.SalesOrderItemText,
                                RequestedQuantity: item.RequestedQuantity,
                                RequestedQuantityUnit: item.RequestedQuantityUnit,
                                // ItemGrossWeight: item.ItemGrossWeight,
                                // ItemNetWeight: item.ItemNetWeight,
                                // ItemWeightUnit: item.ItemWeightUnit,
                                // NetAmount: item.NetAmount,
                                // MaterialGroup: item.MaterialGroup,
                                // ProductionPlant: item.ProductionPlant,
                                // StorageLocation: item.StorageLocation,
                                // DeliveryGroup: item.DeliveryGroup,
                                // ShippingPoint: item.ShippingPoint
                            }))
                        }
                    };

                    const response = await this.s4HanaSales.run(
                        INSERT.into('A_SalesOrder').entries(payload)
                    );

                    console.log('S/4HANA response:', response);
                    req.data.SalesOrder = response.SalesOrder;
                    req.data.SalesOrganization = response.SalesOrganization;
                } catch (error) {
                    console.error('Error posting to S/4HANA:', error);
                    req.error(500, 'Failed to create sales order in S/4HANA', error);
                }
            }
        });

        this.on('postSalesOrder', async (req) => {

            const sanitizeNumber = (value) => {
                if (typeof value === "string") {
                    return parseFloat(value.replace(/[^0-9.]/g, "")) || 0;
                }
                return value;
            };

            const documentId = new SequenceHelper({
                db: db,
                sequence: "ZSALES_DOCUMENT_ID",
                table: "zsalesorder_SalesOrderEntity",
                field: "documentId",
            });

            let number = await documentId.getNextNumber();

            // const today = new Date();
            const folderId = req.data.dmsFolder.replace('spa-res:cmis:folderid:', '');

            const newSalesorder = {
                data: {
                    senderMail: req.data.senderMail,
                    documentId: number.toString(),
                    dmsFolder: folderId || '',
                    mode: 'email',
                    DraftAdministrativeData_DraftUUID: cds.utils.uuid(),
                    IsActiveEntity: true
                }
            };

            try {
                const oSalesorder = await this.send({
                    query: INSERT.into(salesorder).entries(newSalesorder.data),
                    event: "NEW",
                });

                const url = `https://yk2lt6xsylvfx4dz.launchpad.cfapps.us10.hana.ondemand.com/site/Kruger#Zsalesorder-manage?sap-ui-app-id-hint=saas_approuter_salesorder&/salesorder(ID=${oSalesorder.ID},IsActiveEntity=true)?layout=TwoColumnsMidExpanded`;

                return {
                    documentId: oSalesorder.documentId,
                    salesorder: oSalesorder.salesorder,
                    SalesOrderType: oSalesorder.SalesOrderType,
                    message: oSalesorder.status,
                    url: url,
                    v: oSalesorder.salesorder ? 'S' : 'E'
                };
            } catch (error) {
                console.error("Error posting invoice:", error);
                return {
                    documentId: "",
                    salesorder: "",
                    SalesOrderType: "",
                    message: "Error posting sales order: " + error.message,
                    indicator: "E"
                };
            }


        });

        async function streamToBuffer(stream) {
            return new Promise((resolve, reject) => {
                const chunks = [];
                stream.on('data', (chunk) => chunks.push(Buffer.from(chunk))); // Collect chunks as Buffers
                stream.on('error', (err) => reject(err)); // Handle errors
                stream.on('end', () => resolve(Buffer.concat(chunks))); // Resolve final Buffer
            });
        }

        // this.on('processDocument', async (req) => {
        //     try {

        //         const decodedBuffer = Buffer.from(req.data.salesOrder.attachments[0].content, 'base64');
        //         // entitySet.attachments = attachDocs;
        //         const attachDocs = {
        //             mimeType: req.data.salesOrder.attachments[0].mimeType,
        //             filename: req.data.salesOrder.attachments[0].filename,
        //             content: decodedBuffer,
        //             url: req.data.salesOrder.attachments[0].url,
        //             DraftAdministrativeData_DraftUUID: cds.utils.uuid(),
        //         };


        //         const newSalesorder = {
        //             IsActiveEntity: false,
        //             DraftAdministrativeData_DraftUUID: cds.utils.uuid(),
        //             attachments: attachDocs
        //         };

        //         const oSalesorder = await this.send({
        //             query: INSERT.into(salesorder).entries(newSalesorder),
        //             event: "NEW",
        //         });


        //         // Process document
        //         const attachment = req.data.salesOrder.attachments[0];
        //         const form = new FormData();
        //         const fileBuffer = Buffer.from(attachment.content.split(',')[1], 'base64');
        //         form.append('file', fileBuffer, {
        //             filename: attachment.filename,
        //             contentType: attachment.mimeType
        //         });

        //         const options = {
        //             schemaName: 'SAP_purchaseOrder_schema',
        //             clientId: 'default',
        //             documentType: 'Purchase Order',
        //             receivedDate: new Date().toISOString().slice(0, 10),
        //             enrichment: {
        //                 sender: { top: 5, type: "businessEntity", subtype: "supplier" },
        //                 employee: { type: "employee" }
        //             }
        //         };
        //         form.append('options', JSON.stringify(options));

        //         let status = '';
        //         let extractionResults;

        //         // Submit document for extraction with error handling
        //         try {
        //             const extractionResponse = await this.DocumentExtraction_Dest.send({
        //                 method: 'POST',
        //                 path: '/',
        //                 data: form,
        //                 headers: {
        //                     'Content-Type': 'multipart/form-data',
        //                     'Content-Length': form.getLengthSync()
        //                 }
        //             });

        //             if (extractionResponse.status === 'PENDING') {
        //                 // Poll for results
        //                 let retries = 0;
        //                 let jobDone = false;

        //                 while (!jobDone && retries < MAX_RETRIES) {
        //                     const jobStatus = await this.DocumentExtraction_Dest.get(`/${extractionResponse.id}`);
        //                     console.log(`Attempt ${retries + 1}: Current job status is '${jobStatus.status}'`);

        //                     if (jobStatus.status === "DONE") {
        //                         jobDone = true;
        //                         extractionResults = jobStatus.extraction;
        //                     } else {
        //                         await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        //                         retries++;
        //                     }
        //                 }

        //                 if (!jobDone) {
        //                     status = `Extraction failed after ${MAX_RETRIES} attempts`;
        //                     await updateDraftOnly(oSalesorder.ID, status);
        //                     return;
        //                 }
        //             }
        //         } catch (error) {
        //             status = `Document extraction failed: ${error.message}`;
        //             await updateDraftOnly(oSalesorder.ID, status);
        //             return;
        //         }

        //         // Map extraction results
        //         const headerFields = extractionResults.headerFields.reduce((acc, field) => {
        //             acc[field.name] = field.value;
        //             return acc;
        //         }, {});

        //         const lineItems = extractionResults.lineItems.map(item => {
        //             return item.reduce((acc, field) => {
        //                 acc[field.name] = field.value;
        //                 return acc;
        //             }, {});
        //         });

        //         const removeSpecialCharacters = (str) => {
        //             if (!str) return str;
        //             return str.replace(/[^a-zA-Z0-9\s]/g, '');
        //         };

        //         // Separate BP lookups with error handling
        //         let soldToResponse = null;
        //         let shipToResponse = null;

        //         try {
        //             soldToResponse = await this.s4HanaBP.run(
        //                 SELECT.one.from('A_BusinessPartnerAddress')
        //                     .where({
        //                         StreetName: removeSpecialCharacters(headerFields.senderStreet),
        //                         HouseNumber: removeSpecialCharacters(headerFields.senderHouseNumber),
        //                         CityName: removeSpecialCharacters(headerFields.senderCity),
        //                         PostalCode: removeSpecialCharacters(headerFields.senderPostalCode),
        //                         Region: removeSpecialCharacters(headerFields.senderState)
        //                     })
        //             );
        //         } catch (error) {
        //             status = `SoldTo BP lookup failed: ${error.message}`;
        //         }

        //         try {
        //             shipToResponse = await this.s4HanaBP.run(
        //                 SELECT.one.from('A_BusinessPartnerAddress')
        //                     .where({
        //                         // StreetName: removeSpecialCharacters(headerFields.shipToStreet),
        //                         HouseNumber: headerFields.shipToHouseNumber,
        //                         CityName: headerFields.shipToCity,
        //                         PostalCode: headerFields.shipToPostalCode,
        //                         Region: headerFields.shipToState,
        //                         Country: headerFields.shipToCountryCode
        //                     })
        //             );
        //         } catch (error) {
        //             status = `ShipTo BP lookup failed: ${error.message}`;
        //         }


        //         // Check if both BP lookups failed
        //         if (!soldToResponse && !shipToResponse) {
        //             status = 'Both Business Partner lookups failed';
        //             await updateDraftOnly(oSalesorder.ID, status);
        //             return;
        //         }

        //         // Create S4HANA sales order
        //         const salesOrderPayload = {
        //             SalesOrderType: 'OR',
        //             SoldToParty: '1000294',//soldToResponse?.BusinessPartner || shipToResponse?.BusinessPartner,
        //             TransactionCurrency: headerFields.currencyCode || '',
        //             SalesOrderDate: new Date(headerFields.documentDate || Date.now()).toISOString(),
        //             RequestedDeliveryDate: new Date(headerFields.requestedDeliveryDate || Date.now()).toISOString(),
        //             to_Item: {
        //                 results: lineItems.map((item, index) => ({
        //                     SalesOrderItem: String((index + 1) * 10),
        //                     Material: item.customerMaterialNumber || '',
        //                     SalesOrderItemText: item.description || '',
        //                     RequestedQuantity: parseFloat(item.quantity) || 0
        //                 }))
        //             }
        //         };

        //         try {
        //             const s4Response = await this.s4HanaSales.run(
        //                 INSERT.into('A_SalesOrder').entries(salesOrderPayload)
        //             );

        //             const dbUpdatePayload = {
        //                 SalesOrder: s4Response.SalesOrder,
        //                 SalesOrderType: s4Response.SalesOrderType,
        //                 SoldToParty: s4Response.SoldToParty,
        //                 TransactionCurrency: s4Response.TransactionCurrency,
        //                 SalesOrderDate: s4Response.SalesOrderDate,
        //                 RequestedDeliveryDate: s4Response.RequestedDeliveryDate,
        //                 Status: 'Sales Order Created',
        //                 DraftAdministrativeData_DraftUUID: oSalesorder.DraftAdministrativeData_DraftUUID,
        //                 IsActiveEntity: true
        //             };


        //             // Update sales order draft
        //             await db.run(
        //                 UPDATE(salesorder.drafts)
        //                     .set(dbUpdatePayload)
        //                     .where({ ID: oSalesorder.ID })
        //             );

        //             // Get updated draft
        //             const entitySet = await db.run(
        //                 SELECT.one.from(salesorder.drafts)
        //                     .columns(cpx => {
        //                         cpx`*`,
        //                             cpx.to_Item(cfy => { cfy`*` }),
        //                             cpx.attachments(afy => { afy`*` })
        //                     })
        //                     .where({ ID: oSalesorder.ID })
        //             );

        //             const lineItemsPayload = lineItems.map((item, index) => ({
        //                 SalesOrder: s4Response.SalesOrder,
        //                 SalesOrderItem: String((index + 1) * 10),
        //                 Material: item.customerMaterialNumber,
        //                 SalesOrderItemText: item.description,
        //                 RequestedQuantity: parseFloat(item.quantity),
        //                 up__ID: oSalesorder.ID,
        //                 DraftAdministrativeData_DraftUUID: cds.utils.uuid(),
        //             }));


        //             entitySet.to_Item = lineItemsPayload;
        //             // Insert into main table and delete draft only on success
        //             await INSERT(entitySet).into(salesorder);

        //             // Optional: Delete the draft after successful insertion

        //             await DELETE(salesorder.drafts).where({
        //                 DraftAdministrativeData_DraftUUID: oSalesorder.DraftAdministrativeData_DraftUUID,
        //             });

        //             req.notify("Order has been successfully created");
        //             return entitySet;

        //         } catch (error) {
        //             status = `S4HANA Sales Order creation failed: ${error.message}`;
        //             await updateDraftOnly(oSalesorder.ID, status);
        //             return;
        //         }

        //     } catch (error) {
        //         console.error('Error in process:', error);
        //         req.error(500, `Processing error: ${error.message}`);
        //     }
        // });

        // this.on('postSalesWorkflow', async (req) => {

        //     const newSalesorder = {
        //         TransactionCurrency: req.data.currencyCode,
        //         to_Item: req.data.to_Item.map(item => ({
        //             Material: item.customerMaterialNumber || '',
        //             SalesOrderItemText: item.description || '',
        //             RequestedQuantity: parseFloat(item.quantity) || 0
        //         })),
        //         DraftAdministrativeData_DraftUUID: cds.utils.uuid(),
        //     };

        //     const oSalesorder = await this.send({
        //         query: INSERT.into(salesorder).entries(newSalesorder),
        //         event: "NEW",
        //     });
        //     // Construct the sales order payload
        //     const salesOrderPayload = {
        //         SalesOrderType: 'OR',
        //         SoldToParty: '1000294', // Use the relevant party data
        //         TransactionCurrency: req.data.currencyCode || '',
        //         SalesOrderDate: new Date(req.data.documentDate || Date.now()).toISOString(),
        //         RequestedDeliveryDate: new Date(req.data.requestedDeliveryDate || Date.now()).toISOString(),
        //         to_Item: {
        //             results: req.data.to_Item.map((item, index) => ({
        //                 SalesOrderItem: String((index + 1) * 10),
        //                 Material: item.customerMaterialNumber || '',
        //                 SalesOrderItemText: item.description || '',
        //                 RequestedQuantity: parseFloat(item.quantity) || 0
        //             }))
        //         }
        //     };

        //     try {
        //         const s4Response = await this.s4HanaSales.run(
        //             INSERT.into('A_SalesOrder').entries(salesOrderPayload)
        //         );

        //         const dbUpdatePayload = {
        //             SalesOrder: s4Response.SalesOrder,
        //             SalesOrderType: s4Response.SalesOrderType,
        //             SoldToParty: s4Response.SoldToParty,
        //             TransactionCurrency: s4Response.TransactionCurrency,
        //             SalesOrderDate: s4Response.SalesOrderDate,
        //             RequestedDeliveryDate: s4Response.RequestedDeliveryDate,
        //             Status: 'Sales Order Created',
        //             DraftAdministrativeData_DraftUUID: oSalesorder.DraftAdministrativeData_DraftUUID,
        //             IsActiveEntity: true
        //         };


        //         // Update sales order draft
        //         await db.run(
        //             UPDATE(salesorder.drafts)
        //                 .set(dbUpdatePayload)
        //                 .where({ ID: oSalesorder.ID })
        //         );

        //         // Get updated draft
        //         const entitySet = await db.run(
        //             SELECT.one.from(salesorder.drafts)
        //                 .columns(cpx => {
        //                     cpx`*`,
        //                         cpx.to_Item(cfy => { cfy`*` }),
        //                         cpx.attachments(afy => { afy`*` })
        //                 })
        //                 .where({ ID: oSalesorder.ID })
        //         );

        //         const lineItemsPayload = lineItems.map((item, index) => ({
        //             SalesOrder: s4Response.SalesOrder,
        //             SalesOrderItem: String((index + 1) * 10),
        //             Material: item.customerMaterialNumber,
        //             SalesOrderItemText: item.description,
        //             RequestedQuantity: parseFloat(item.quantity),
        //             up__ID: oSalesorder.ID,
        //             DraftAdministrativeData_DraftUUID: cds.utils.uuid(),
        //         }));


        //         entitySet.to_Item = lineItemsPayload;
        //         // Insert into main table and delete draft only on success
        //         await INSERT(entitySet).into(salesorder);

        //         await DELETE(salesorder.drafts).where({
        //             DraftAdministrativeData_DraftUUID: oSalesorder.DraftAdministrativeData_DraftUUID,
        //         });
        //         return {
        //             message: 'Sales Order Successfully Created',
        //             indicator: 'Y',
        //             salesorder: s4Response.SalesOrder
        //         };

        //     } catch (error) {
        //         await updateDraftOnly(oSalesorder.ID, `S4HANA Sales Order creation failed: ${error.message}`);
        //         return {
        //             message: `S4HANA Sales Order creation failed: ${error.message}`,
        //             indicator: 'N',
        //         }
        //     }
        // });

        // Helper function to update draft status without creating final record
        // async function updateDraftOnly(ID, status) {
        //     await db.run(
        //         UPDATE(salesorder.drafts)
        //             .set({ Status: status })
        //             .where({ ID: ID })
        //     );
        // }


        await super.init();
    }
}

module.exports = { SalesCatalogService };