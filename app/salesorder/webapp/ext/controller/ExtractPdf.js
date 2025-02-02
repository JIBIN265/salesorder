sap.ui.define([
    "sap/m/MessageToast",
    "sap/m/Button",
    "sap/ui/core/message/Message",
    "sap/ui/core/message/MessageType"
], function (MessageToast, Button, Message, MessageType) {
    'use strict';

    return {
        onPress: async function (oEvent) {
            debugger;
            var oitems = oEvent.getSource().getParent().getParent().getParent().getAggregation('items')
            if (oitems.length === 0) {
                MessageToast.show("Add at least one item to the table before submitting.");
                return;
            }
            var contextData = {
                oEditFlow: this.getEditFlow(),
                oModel: this.getModel(),
                oContext: oEvent.getSource().getBindingContext(),
                // salesorder::salesorderList--fe::table::salesorder::LineItem-innerTable-listUl
                oTable: this.byId('salesorder::salesorderList--fe::table::salesorder::LineItem-innerTable-listUl')
            };
            // const applyDoc = await contextData.oEditFlow.applyDocument(contextData.oContext)
            contextData.oEditFlow.saveDocument(contextData.oContext)
                .then(() => {
                    debugger
                    contextData.oTable.refresh();
                    let sPath = contextData.oContext.getPath().replace(false, true);
                    //get object
                    let oBindContext = contextData.oModel.bindContext(sPath);
                    contextData.oEditFlow.getInternalRouting().navigateToContext(oBindContext);

                });

            oEvent.getSource().getParent().getParent().getParent().getParent().getParent().getParent().getParent().close()
        },
        ExtractPdf: async function (oEvent) {
            var that = this;
            var oModel = this.getModel();
            debugger
            // Create an object to hold necessary references
            var contextData = {
                oEditFlow: this.getEditFlow(),
                oModel: oModel,
                oContext: null, // to hold context after creation
                iD: null,
                oTable: this.byId('salesorder::salesorderList--fe::table::salesorder::LineItem-innerTable-listUl')
            };

            // Create a new root entity record
            var sPath = "/salesorder";
            var oListBinding = contextData.oModel.bindList(sPath);
            contextData.oContext = oListBinding.create(); // Store context here
            await contextData.oContext.created();
            await contextData.oEditFlow.getInternalRouting().navigateToContext(contextData.oContext);
            contextData.iD = contextData.oContext.getProperty('ID')
            if (!this.fragmentTwo) {
                this.fragmentTwo = this.loadFragment({
                    id: "fragmentTwo",
                    name: "salesorder.ext.controller.ExtractPdf",
                    controller: this
                });
            }

            this.fragmentTwo.then(async function (dialog) {
                dialog.setBindingContext(contextData.oContext);
                dialog.setModel(contextData.oModel);

                // Cancel button with contextData.oEditFlow
                dialog.setEndButton(new Button({
                    text: "Cancel",
                    press: async function (oEvent) {
                        debugger;
                        await contextData.oEditFlow.getInternalRouting().navigateBackFromContext(contextData.oContext);
                        contextData.oContext.delete();
                        contextData.oTable.refresh();
                        // oEvent.getSource().getParent().getParent().getContent()[0].getContent().refresh();
                        contextData.oEditFlow.getView().getModel("ui").setProperty("/isEditable", false);
                        dialog.close();

                    }
                }));

                await dialog.getModel("ui").setProperty("/isEditable", true);

                dialog.open();
            });
        },

        closeDialog: function (oEvent) {
            oEvent.getSource().getParent().close();
        }

    };
});