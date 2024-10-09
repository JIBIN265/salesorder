//@ui5-bundle salesorder/Component-preload.js
sap.ui.require.preload({
	"salesorder/Component.js":function(){
sap.ui.define(["sap/fe/core/AppComponent"],function(e){"use strict";return e.extend("salesorder.Component",{metadata:{manifest:"json"}})});
},
	"salesorder/ext/controller/Uploadpdf.fragment.xml":'<core:FragmentDefinition\n    xmlns="sap.m"\n    id="uploadPdfFragment"\n    xmlns:l="sap.ui.layout"\n    xmlns:core="sap.ui.core"\n    xmlns:u="sap.ui.unified"\n    xmlns:upload="sap.m.upload"\n><Dialog\n        id="uploadDialogSet"\n        title="PDF Upload"\n        closeOnNavigation="true"\n        draggable="true"\n        resizable="true"\n    ><content><upload:UploadSet \n                mode="SingleSelect"\n                uploadEnabled="true"\n                instantUpload="true"\n                id="uploadSet"\n                items="{path: \'/\', templateShareable: false}"\n                maxFileNameLength="128"\n                multiple="false"\n                fileTypes="pdf"\n                terminationEnabled="true"\n            ><upload:items><upload:UploadSetItem \n                        id="_IDGenUploadSetItem1"\n                        visibleRemove="true"\n                        visibleEdit="false"\n                        selected="true"\n                        fileName="{name}"\n                        url="/upload"\n                    /></upload:items></upload:UploadSet></content></Dialog></core:FragmentDefinition>',
	"salesorder/ext/controller/Uploadpdf.js":function(){
sap.ui.define(["sap/ui/core/Fragment","sap/m/Button","sap/m/MessageToast"],function(e,a,o){"use strict";var t=function(a,t,i){var l=e.byId("uploadPdfFragment","uploadSet");var s=l.getItems();if(s.length===0){o.show("Please choose a file first.");return}var n=s[0].getFileObject();if(n.size>200*1024){o.show("Large file detected. Uploading may take a while. Please wait...",{duration:5e3})}else{o.show("Uploading file. Please wait...",{duration:2e3})}var r=new FileReader;r.onload=async function(e){var a=e.target.result;try{debugger;var t={FileName:n.name,MimeType:n.type,FileSize:n.size,FileContent:a.split(",")[1]};var l="/salesorder";var s=i.bindList(l);await s.create(t);o.show("File uploaded successfully!")}catch(e){o.show("Error uploading file: "+e.message)}};r.readAsDataURL(n);t.close();l.removeAllItems()};return{UploadPdf:function(i){var l=this;var s=this.getModel();if(!this.oDialog){e.load({id:"uploadPdfFragment",name:"salesorder.ext.controller.Uploadpdf",type:"XML",controller:this}).then(function(e){l.oDialog=e;l.oDialog.setBeginButton(new a({text:"Upload",press:function(e){t(e,l.oDialog,s)}}));l.oDialog.setEndButton(new a({text:"Close",press:function(){l.oDialog.close()}}));l.oDialog.open()}).catch(function(e){o.show("Error loading PDF Upload Dialog: "+e.message)})}else{this.oDialog.open()}}}});
},
	"salesorder/i18n/i18n.properties":'# This is the resource bundle for salesorder\n\n#Texts for manifest.json\n\n#XTIT: Application name\nappTitle=Sales Order Management\n\n#YDES: Application description\nappDescription=Sales Order Management\n\n#XFLD,66\nflpTitle=Sales Order Management\n\n#XCOL: Custom action text\nuploadPdf=Upload PDF\n',
	"salesorder/manifest.json":'{"_version":"1.65.0","sap.app":{"id":"salesorder","type":"application","i18n":"i18n/i18n.properties","applicationVersion":{"version":"0.0.1"},"title":"{{appTitle}}","description":"{{appTitle}}","resources":"resources.json","sourceTemplate":{"id":"@sap/generator-fiori:lrop","version":"1.15.1","toolsId":"eb34e418-2813-40b2-9301-1907a9e9f026"},"dataSources":{"mainService":{"uri":"odata/v4/sales-catalog/","type":"OData","settings":{"annotations":[],"odataVersion":"4.0"}}},"crossNavigation":{"inbounds":{"salesorder-manage":{"semanticObject":"salesorder","action":"manage","title":"{{flpTitle}}","signature":{"parameters":{},"additionalParameters":"allowed"}}}}},"sap.ui":{"technology":"UI5","icons":{"icon":"","favIcon":"","phone":"","phone@2":"","tablet":"","tablet@2":""},"deviceTypes":{"desktop":true,"tablet":true,"phone":true}},"sap.ui5":{"flexEnabled":true,"dependencies":{"minUI5Version":"1.129.0","libs":{"sap.m":{},"sap.ui.core":{},"sap.fe.templates":{},"sap.f":{}}},"contentDensities":{"compact":true,"cozy":true},"models":{"i18n":{"type":"sap.ui.model.resource.ResourceModel","settings":{"bundleName":"salesorder.i18n.i18n"}},"":{"dataSource":"mainService","preload":true,"settings":{"operationMode":"Server","autoExpandSelect":true,"earlyRequests":true}},"@i18n":{"type":"sap.ui.model.resource.ResourceModel","uri":"i18n/i18n.properties"}},"resources":{"css":[]},"routing":{"config":{"flexibleColumnLayout":{"defaultTwoColumnLayoutType":"TwoColumnsMidExpanded","defaultThreeColumnLayoutType":"ThreeColumnsMidExpanded"},"routerClass":"sap.f.routing.Router"},"routes":[{"pattern":":?query:","name":"salesorderList","target":["salesorderList"]},{"pattern":"salesorder({key}):?query:","name":"salesorderObjectPage","target":["salesorderList","salesorderObjectPage"]}],"targets":{"salesorderList":{"type":"Component","id":"salesorderList","name":"sap.fe.templates.ListReport","options":{"settings":{"contextPath":"/salesorder","variantManagement":"Page","navigation":{"salesorder":{"detail":{"route":"salesorderObjectPage"}}},"controlConfiguration":{"@com.sap.vocabularies.UI.v1.LineItem":{"tableSettings":{"type":"ResponsiveTable","selectAll":true}}},"initialLoad":"Enabled","content":{"header":{"actions":{"UploadPdf":{"press":"salesorder.ext.controller.Uploadpdf.UploadPdf","visible":true,"enabled":true,"text":"Upload PDF"}}}}}},"controlAggregation":"beginColumnPages","contextPattern":""},"salesorderObjectPage":{"type":"Component","id":"salesorderObjectPage","name":"sap.fe.templates.ObjectPage","options":{"settings":{"editableHeaderContent":false,"contextPath":"/salesorder","controlConfiguration":{"to_Item/@com.sap.vocabularies.UI.v1.LineItem#i18nItemDetails":{"tableSettings":{"condensedTableLayout":true,"enableFullScreen":true,"selectAll":true,"type":"GridTable"}}}}},"controlAggregation":"midColumnPages","contextPattern":"/salesorder({key})"}}},"rootView":{"viewName":"sap.fe.templates.RootContainer.view.Fcl","type":"XML","async":true,"id":"appRootView"}},"sap.fiori":{"registrationIds":[],"archeType":"transactional"}}'
});
//# sourceMappingURL=Component-preload.js.map
