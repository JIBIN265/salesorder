//@ui5-bundle salesorder/Component-preload.js
sap.ui.require.preload({
	"salesorder/Component.js":function(){
sap.ui.define(["sap/fe/core/AppComponent"],function(e){"use strict";return e.extend("salesorder.Component",{metadata:{manifest:"json"}})});
},
	"salesorder/ext/controller/FileUploadDialog.fragment.xml":'<core:FragmentDefinition xmlns="sap.m"\n    xmlns:core="sap.ui.core"\n    xmlns:l="sap.ui.layout"\n    xmlns:u="sap.ui.unified" id="idFileUploadDialogFragmentDefinition" class="sapUiTinyMarginTop"><Dialog id="idAddViaUrlDialog" title="PDF Upload" type="Message" draggable="true" resizable="true" contentWidth="auto" contentHeight="auto" class="sapUiSmallMargin"><content><l:VerticalLayout id="idGenVerticalLayout"><HBox id="idFileGenHBox" backgroundDesign="Solid" fitContainer="true"><VBox id="idUploadGenVBox" class="sapUiSmallMarginEnd" fitContainer="true"><u:FileUploader style="Emphasized" id="idFileUploader" name="myFileUpload" \n                        uploadUrl="salesorder/attachments" tooltip="Upload your file from local server" \n                        fileType="pdf" placeholder="Choose or drag a file for upload..."></u:FileUploader></VBox></HBox></l:VerticalLayout><List id="idUrlList"><items><CustomListItem id="idCustomListItem"><HBox id="idGenHBox" class="sapUiSmallMargin" alignItems="Center"><VBox id="idProgressGenVBox" class="sapUiSmallMarginEnd" width="100%"><Label id="idProgressGenLabel" text="Progress"/><ProgressIndicator id="idProgressIndicator" displayValue="0%"/></VBox><VBox id="idGenVBox" class="sapUiSmallMarginEnd"><Label id="idExtractPDFLabel" text="Extract PDF" /><CheckBox id="idExtractPdfCheckBox" selected="true" enabled="false"/></VBox></HBox></CustomListItem></items></List></content></Dialog></core:FragmentDefinition>\n',
	"salesorder/ext/controller/FileUploadDialog.js":function(){
sap.ui.define(["sap/ui/core/Fragment","sap/m/Button","sap/m/MessageToast","sap/ui/model/json/JSONModel"],function(e,t,a,i){"use strict";var o=function(t,i){var o=e.byId("idFileUploadDialogFragmentDefinition","idFileUploader");var l=e.byId("idFileUploadDialogFragmentDefinition","idProgressIndicator");if(!o.getValue()){a.show("Please select a file first.");return}t.setBusy(true);l.setDisplayValue("0%");l.setPercentValue(0);var n=o.oFileUpload.files;if(n.length>0){var s=n[0];var r=new FileReader;r.onprogress=function(e){if(e.lengthComputable){var t=Math.round(e.loaded/e.total*100);l.setDisplayValue(t+"%");l.setPercentValue(t)}};r.onload=async function(e){try{const t=URL.createObjectURL(s);var n={attachments:[{filename:s.name,mimeType:s.type,url:t,content:e.target.result}]};let a="processDocument";let o={model:i.getView().getModel(),parameterValues:[{name:"salesOrder",value:n}],invocationGrouping:"isolated",skipParameterDialog:true};debugger;const l=await i.invokeAction(a,o)}catch(e){a.show("Error uploading file: "+e.message)}finally{t.setBusy(false);o.clear();l.setDisplayValue("0%");l.setPercentValue(0);t.close()}};r.readAsDataURL(s)}};return{FileUploadDialog:function(){var i=this;var l=this.getModel();var n=this.getEditFlow();if(!this.pDialog){e.load({id:"idFileUploadDialogFragmentDefinition",name:"salesorder.ext.controller.FileUploadDialog",type:"XML",controller:this}).then(function(e){i.pDialog=e;i.getEditFlow().getView().addDependent(i.pDialog);i.pDialog.setBeginButton(new t({text:"Upload",press:function(){o(i.pDialog,n)}}));i.pDialog.setEndButton(new t({text:"Cancel",press:function(){i.pDialog.close()}}));i.pDialog.open()}).catch(function(e){a.show("Error loading dialog: "+e.message)})}else{this.pDialog.open()}},closeAddViaUrlFragment:function(){this.pDialog.close()}}});
},
	"salesorder/ext/controller/Uploadpdf.fragment.xml":'<core:FragmentDefinition\n    xmlns="sap.m"\n    id="uploadPdfFragment"\n    xmlns:l="sap.ui.layout"\n    xmlns:core="sap.ui.core"\n    xmlns:u="sap.ui.unified"\n    xmlns:upload="sap.m.upload"\n    xmlns:macros="sap.fe.macros"\n><Dialog\n        id="uploadDialogSet"\n        title="PDF Upload"\n        closeOnNavigation="true"\n        draggable="true"\n        resizable="true"\n    ><content><upload:UploadSet \n                mode="SingleSelect"\n                uploadEnabled="true"\n                instantUpload="false"\n                id="uploadSet"\n                items="{path: \'\', templateShareable: false}"\n                maxFileNameLength="128"\n                multiple="false"\n                fileTypes="pdf"\n                terminationEnabled="true"\n            ><upload:items><upload:UploadSetItem \n                        id="_IDGenUploadSetItem1"\n                        visibleRemove="true"\n                        visibleEdit="false"\n                        selected="true"\n                        fileName="{name}"\n                    /></upload:items></upload:UploadSet><Panel id="_IDGenPanel" headerText="Form Based on a Reference Facet" binding="{path:\'/salesorder(\\\'1\\\')\'}"><macros:Form metaPath="/salesorder/@com.sap.vocabularies.UI.v1.FieldGroup#GeneratedGroup" id="myForm" title="Something Else"><macros:FormElement\n\t\t\t\tmetaPath="ID"\n\t\t\t\tid="formElementMacroID"\n\t\t\t\tlabel="ID Property After Number"\n\t\t\t\tplacement="After"\n\t\t\t\tanchor="DataField::PricingDate"\n\t\t\t/><macros:FormElement metaPath="SalesOrderDate" id="customSlider" placement="Before" label="Slider Example"><macros:fields><Slider id="_IDGenSlider" /></macros:fields></macros:FormElement></macros:Form></Panel></content></Dialog></core:FragmentDefinition>',
	"salesorder/ext/controller/Uploadpdf.js":function(){
sap.ui.define(["sap/ui/core/Fragment","sap/m/Button","sap/m/MessageToast"],function(e,t,a){"use strict";var o=false;var s=function(t,s,i,l){var r=e.byId("uploadPdfFragment","uploadSet");var n=r.getAggregation("incompleteItems");if(n.length===0){a.show("Please choose a file first.");return}var g=n[0].getFileObject();if(g.size>200*1024){a.show("Large file detected. Uploading may take a while. Please wait...",{duration:5e3})}else{a.show("Uploading file. Please wait...",{duration:2e3})}s.setBusy(true);var d=new FileReader;d.onload=async function(e){try{const o=URL.createObjectURL(g);var t={attachments:[{filename:g.name,mimeType:g.type,url:o,content:e.target.result.split(",")[1]}]};var n="/salesorder";var d=i.bindList(n);debugger;let s="processDocument";let r={model:l.getView().getModel(),parameterValues:[{name:"salesOrder",value:t}],invocationGrouping:"isolated",skipParameterDialog:true};var u=await l.invokeAction(s,r).then(function(e){debugger});debugger;a.show("File processed successfully!")}catch(e){a.show("Error uploading file: "+e.message)}finally{s.setBusy(false);o=false;s.close();r.removeAllItems()}};d.readAsDataURL(g)};return{UploadPdf:function(i){var l=this;var r=this.getModel();debugger;var n=this.getEditFlow();o=true;if(!this.oDialog){e.load({id:"uploadPdfFragment",name:"salesorder.ext.controller.Uploadpdf",type:"XML",controller:this}).then(function(e){l.oDialog=e;l.oDialog.setBeginButton(new t({text:"Upload",press:function(e){s(e,l.oDialog,r,n)}}));l.oDialog.setEndButton(new t({text:"Close",press:function(){l.oDialog.close()}}));l.oDialog.open()}).catch(function(e){a.show("Error loading PDF Upload Dialog: "+e.message)})}else{this.oDialog.open()}}}});
},
	"salesorder/ext/controller/Viewpdf.fragment.xml":'<core:FragmentDefinition xmlns:core="sap.ui.core" xmlns:m="sap.ui.model" xmlns:mvc="sap.ui.core.mvc" xmlns="sap.m"><Dialog \n        core:require="{handler: \'salesorder/ext/controller/Viewpdf\'}"\n        id="pdfDialog" \n        title="PDF Viewer"\n        \n        class="sapUiResponsivePadding--header sapUiResponsivePadding--content"\n        afterClose="onDialogClose" draggable="true" contentHeight="600px" \n        contentWidth="600px" resizable= "true" ><content><PDFViewer\n                id="pdfViewer" \n                source="" \n                isTrustedSource="true"\n                \n                displayType="Embedded"\n                height="600px"\n                width="600px"><layoutData><FlexItemData id="_IDGenFlexItemData1" growFactor="1" /></layoutData></PDFViewer></content><endButton><Button id="_IDGenButton"  \n            text="Close"\n             tooltip="Close"\n             icon="sap-icon://cancel" \n             type="Reject" \n             press="onClose"/></endButton></Dialog></core:FragmentDefinition>',
	"salesorder/ext/controller/Viewpdf.js":function(){
sap.ui.define(["sap/m/MessageToast","sap/ui/core/Fragment","sap/m/Button"],function(o,e,t){"use strict";return{viewpdf:function(n,i){o.show("Custom handler invoked.");debugger;const s=i[0];if(!s){o.show("No context found.");return}var a=s.getProperty("content");var r=this;if(!this.oDialog){e.load({id:"pdfDialog",name:"salesorder.ext.controller.Viewpdf",type:"XML",controller:this}).then(function(o){r.oDialog=o;var n=e.byId("pdfDialog","pdfViewer");n.setSource(a);var i=new t({text:"Close",icon:"sap-icon://cancel",type:"Reject",press:function(){r.oDialog.close()}});o.addButton(i);r.oDialog.open()}).catch(function(e){o.show("Error loading PDF Viewer: "+e.message)})}else{var l=e.byId("pdfDialog","pdfViewer");l.setSource(a);this.oDialog.open()}},onClose:function(){this.oDialog.close();o.show("Dialog closed via End button.")},onDialogClose:function(){o.show("Dialog closed.")}}});
},
	"salesorder/ext/view/ViewPdfPage.controller.js":function(){
sap.ui.define(["sap/fe/core/PageController"],function(e){"use strict";return e.extend("salesorder.ext.view.ViewPdfPage",{onInit:function(){e.prototype.onInit.apply(this,arguments)},handleFullScreen:function(e){this.editFlow.getInternalRouting().switchFullScreen();this.byId("salesorder::attachmentsViewPdfPagePage--enterFullScreenBtn").setVisible(false);this.byId("salesorder::attachmentsViewPdfPagePage--exitFullScreenBtn").setVisible(true)},handleExitFullScreen:function(e){this.editFlow.getInternalRouting().switchFullScreen();this.byId("salesorder::attachmentsViewPdfPagePage--enterFullScreenBtn").setVisible(true);this.byId("salesorder::attachmentsViewPdfPagePage--exitFullScreenBtn").setVisible(false)},handleClose:async function(e){await this.getExtensionAPI().getRouting().navigateToRoute("/")},onBack:function(e){var t=e.getSource().getBindingContext();if(t){this.editFlow.getInternalRouting().navigateBackFromContext(t)}}})});
},
	"salesorder/ext/view/ViewPdfPage.view.xml":'<mvc:View xmlns:core="sap.ui.core"\n\txmlns:mvc="sap.ui.core.mvc"\n\txmlns="sap.m"\n\txmlns:f="sap.f"\n\txmlns:macros="sap.fe.macros"\n\txmlns:html="http://www.w3.org/1999/xhtml" controllerName="salesorder.ext.view.ViewPdfPage"><Page id="ViewPdfPage" title="{i18n&gt;ViewPdfPageTitle}" showNavButton="true" navButtonPress=".onBack" enableScrolling="true"><content><FlexBox id="_IDGenFlexBox" direction="Column" renderType="Div" class="sapUiSmallMargin" fitContainer="true"><OverflowToolbar id="_IDGenOverflowToolbar1"><OverflowToolbarButton type="Transparent" icon="sap-icon://full-screen" press=".handleFullScreen" id="enterFullScreenBtn" tooltip="Enter Full Screen Mode" visible="{= ${/actionButtonsInfo/endColumn/fullScreen} !== null }"/><OverflowToolbarButton type="Transparent" icon="sap-icon://exit-full-screen" press=".handleExitFullScreen" id="exitFullScreenBtn" tooltip="Exit Full Screen Mode" visible="{= ${/actionButtonsInfo/endColumn/exitFullScreen} !== null }"/><OverflowToolbarButton id="_IDGenOverflowToolbarButton" type="Transparent" icon="sap-icon://decline" press=".handleClose" tooltip="Close middle column" visible="{= ${/actionButtonsInfo/endColumn/closeColumn} !== null }"/></OverflowToolbar><PDFViewer id="_IDGenPDFViewer" source="{content}" isTrustedSource="true" loaded=".isLoaded" height="700px" width="auto" title="{status}"><layoutData><FlexItemData id="_IDGenFlexItemData" growFactor="1"/></layoutData></PDFViewer></FlexBox></content></Page></mvc:View>',
	"salesorder/i18n/i18n.properties":'# This is the resource bundle for salesorder\n\n#Texts for manifest.json\n\n#XTIT: Application name\nappTitle=Sales Order Management\n\n#YDES: Application description\nappDescription=Sales Order Management\n\n#XFLD,66\nflpTitle=Sales Order Management\n\n#XCOL: Custom action text\nuploadPdf=Upload PDF\n#XTIT: Custom view title\nViewPdfPageTitle=ViewPdfPage',
	"salesorder/manifest.json":'{"_version":"1.65.0","sap.app":{"id":"salesorder","type":"application","i18n":"i18n/i18n.properties","applicationVersion":{"version":"0.0.1"},"title":"{{appTitle}}","description":"{{appDescription}}","resources":"resources.json","sourceTemplate":{"id":"@sap/generator-fiori:lrop","version":"1.15.1","toolsId":"eb34e418-2813-40b2-9301-1907a9e9f026"},"dataSources":{"mainService":{"uri":"odata/v4/sales-catalog/","type":"OData","settings":{"annotations":[],"odataVersion":"4.0"}}},"crossNavigation":{"inbounds":{"zsalesorder-manage":{"semanticObject":"Zsalesorder","action":"manage","title":"{{flpTitle}}","signature":{"parameters":{},"additionalParameters":"allowed"}}}}},"sap.ui":{"technology":"UI5","icons":{"icon":"","favIcon":"","phone":"","phone@2":"","tablet":"","tablet@2":""},"deviceTypes":{"desktop":true,"tablet":true,"phone":true}},"sap.ui5":{"flexEnabled":true,"dependencies":{"minUI5Version":"1.129.0","libs":{"sap.m":{},"sap.ui.core":{},"sap.fe.templates":{},"sap.f":{},"sap.fe.core":{}}},"contentDensities":{"compact":true,"cozy":true},"models":{"i18n":{"type":"sap.ui.model.resource.ResourceModel","settings":{"bundleName":"salesorder.i18n.i18n"}},"":{"dataSource":"mainService","preload":true,"settings":{"operationMode":"Server","autoExpandSelect":true,"earlyRequests":true}},"@i18n":{"type":"sap.ui.model.resource.ResourceModel","uri":"i18n/i18n.properties"}},"resources":{"css":[]},"routing":{"config":{"flexibleColumnLayout":{"defaultTwoColumnLayoutType":"TwoColumnsMidExpanded","defaultThreeColumnLayoutType":"ThreeColumnsMidExpanded"},"routerClass":"sap.f.routing.Router"},"routes":[{"pattern":":?query:","name":"salesorderList","target":["salesorderList"]},{"pattern":"salesorder({key}):?query:","name":"salesorderObjectPage","target":["salesorderList","salesorderObjectPage"]},{"name":"attachmentsViewPdfPagePage","pattern":"salesorder({key})/attachments({attachmentsKey}):?query:","target":["salesorderList","salesorderObjectPage","attachmentsViewPdfPagePage"]}],"targets":{"salesorderList":{"type":"Component","id":"salesorderList","name":"sap.fe.templates.ListReport","options":{"settings":{"contextPath":"/salesorder","variantManagement":"Page","navigation":{"salesorder":{"detail":{"route":"salesorderObjectPage"}}},"controlConfiguration":{"@com.sap.vocabularies.UI.v1.LineItem":{"tableSettings":{"type":"ResponsiveTable","selectAll":true}}},"initialLoad":"Enabled","content":{"header":{"actions":{"UploadPdf":{"press":"salesorder.ext.controller.FileUploadDialog.FileUploadDialog","visible":true,"enabled":true,"text":"Upload PDF"}}}}}},"controlAggregation":"beginColumnPages","contextPattern":""},"salesorderObjectPage":{"type":"Component","id":"salesorderObjectPage","name":"sap.fe.templates.ObjectPage","options":{"settings":{"editableHeaderContent":false,"contextPath":"/salesorder","controlConfiguration":{"to_Item/@com.sap.vocabularies.UI.v1.LineItem#i18nItemDetails":{"tableSettings":{"condensedTableLayout":true,"enableFullScreen":true,"selectAll":true,"type":"GridTable"}}},"navigation":{"attachments":{"detail":{"route":"attachmentsViewPdfPagePage"}}}}},"controlAggregation":"midColumnPages","contextPattern":"/salesorder({key})"},"attachmentsViewPdfPagePage":{"type":"Component","id":"attachmentsViewPdfPagePage","name":"sap.fe.core.fpm","controlAggregation":"endColumnPages","options":{"settings":{"entitySet":"attachments","viewName":"salesorder.ext.view.ViewPdfPage","contextPath":"/salesorder/attachments"}},"contextPattern":"/salesorder({key})/attachments({attachmentsKey})"}}},"rootView":{"viewName":"sap.fe.templates.RootContainer.view.Fcl","type":"XML","async":true,"id":"appRootView"}},"sap.fiori":{"registrationIds":[],"archeType":"transactional"},"sap.cloud":{"public":true,"service":"hana.app"}}'
});
//# sourceMappingURL=Component-preload.js.map
