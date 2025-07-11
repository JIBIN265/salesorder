using {zsalesorder as persistence} from '../db/schema';
using {API_SALES_ORDER_SRV as so} from './external/API_SALES_ORDER_SRV';
using {API_BUSINESS_PARTNER as bp} from './external/API_BUSINESS_PARTNER';

service SalesCatalogService {
    entity salesorder             as projection on persistence.SalesOrderEntity actions {
            @(Common.SideEffects.TargetEntities: ['/SalesCatalogService.EntityContainer/salesorder'])
            action copySalesorder(in : $self) returns salesorder;
        };
    entity SalesOrderItem         as projection on persistence.SalesOrderEntity.to_Item;
    // entity attachments            as projection on persistence.SalesOrderEntity.attachments;

    entity ApisalesOrder          as
        projection on so.A_SalesOrder {
            *
        };

    entity BusinessPartnerAddress as
        projection on bp.A_BusinessPartnerAddress {
            *
        };

    entity BusinessPartner        as
        projection on bp.A_BusinessPartner {
            *
        };

    annotate SalesCatalogService.salesorder with @odata.draft.enabled;

    action postSalesOrder(
                       senderMail : String,
                       dmsFolder : String
                       ) returns {
        documentId : String(10);
        salesorder : String(10);
        message : String;
        indicator: String(1);
        SalesOrderType : String(4);
        url : String;
    };

    @Common.SideEffects #salesorder    : {TargetEntities: ['/SalesCatalogService.EntityContainer/salesorder']}
    @Common.SideEffects #salesorderItem: {TargetEntities: ['/SalesCatalogService.EntityContainer/SalesOrderItem']}
    action processDocument(salesOrder : salesorder) returns salesorder;
}
