sap.ui.define(["sap/ui/core/Fragment","sap/m/Button","sap/m/MessageToast","sap/ui/model/json/JSONModel"],function(e,t,a,i){"use strict";var o=function(t,i){var o=e.byId("idFileUploadDialogFragmentDefinition","idFileUploader");var l=e.byId("idFileUploadDialogFragmentDefinition","idProgressIndicator");if(!o.getValue()){a.show("Please select a file first.");return}t.setBusy(true);l.setDisplayValue("0%");l.setPercentValue(0);var n=o.oFileUpload.files;if(n.length>0){var s=n[0];var r=new FileReader;r.onprogress=function(e){if(e.lengthComputable){var t=Math.round(e.loaded/e.total*100);l.setDisplayValue(t+"%");l.setPercentValue(t)}};r.onload=async function(e){try{const t=URL.createObjectURL(s);var n={attachments:[{filename:s.name,mimeType:s.type,url:t,content:e.target.result.split(",")[1]}]};let a="processDocument";let o={model:i.getView().getModel(),parameterValues:[{name:"salesOrder",value:n}],invocationGrouping:"isolated",skipParameterDialog:true};debugger;const l=await i.invokeAction(a,o)}catch(e){a.show("Error uploading file: "+e.message)}finally{t.setBusy(false);o.clear();l.setDisplayValue("0%");l.setPercentValue(0);t.close()}};r.readAsDataURL(s)}};return{FileUploadDialog:function(){var i=this;var l=this.getModel();var n=this.getEditFlow();if(!this.pDialog){e.load({id:"idFileUploadDialogFragmentDefinition",name:"salesorder.ext.controller.FileUploadDialog",type:"XML",controller:this}).then(function(e){i.pDialog=e;i.getEditFlow().getView().addDependent(i.pDialog);i.pDialog.setBeginButton(new t({text:"Upload",press:function(){o(i.pDialog,n)}}));i.pDialog.setEndButton(new t({text:"Cancel",press:function(){i.pDialog.close()}}));i.pDialog.open()}).catch(function(e){a.show("Error loading dialog: "+e.message)})}else{this.pDialog.open()}},closeAddViaUrlFragment:function(){this.pDialog.close()}}});
//# sourceMappingURL=FileUploadDialog.js.map