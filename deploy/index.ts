import * as pulumi from "@pulumi/pulumi";
import * as azure from '@pulumi/azure';
import * as azuread from '@pulumi/azuread';

const config = new pulumi.Config()
const location = config.get('location') || "East US";
const nodeCount = 2;
const nodeSize = config.get('nodeSize') || "Standard_D2_v2";
const sshPublicKey = config.require('sshPubKey');

const resourceGroup = new azure.core.ResourceGroup('aks-krustlet', {
    name: 'aks-krustlet',
    location
})

const logAnalytics = new azure.operationalinsights.AnalyticsWorkspace('aksAnalytics', {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    sku: 'PerGB2018',
    retentionInDays: 30
})

const adApp = new azuread.Application('aks-krustlet', {
    displayName: 'aks-krustlet'
});
const adSp = new azuread.ServicePrincipal('krustet-sp', {
    applicationId: adApp.applicationId
})
const adSpPassword = new azuread.ServicePrincipalPassword("krustlet-sp-password", {
    servicePrincipalId: adApp.applicationId,
    endDate: "2099-01-01T00:00:00Z"
})

const krustletCluster = new azure.containerservice.KubernetesCluster('krustlet-cluster', {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    defaultNodePool: {
        name: 'defaultpool',
        nodeCount: nodeCount,
        vmSize: nodeSize
    },
    dnsPrefix: `krustlet-sus`,
    linuxProfile: {
        adminUsername: 'aksuser',
        sshKey: {keyData: sshPublicKey}
    },
    servicePrincipal: {
        clientId: adApp.applicationId,
        clientSecret: adSpPassword.value
    },
    addonProfile: {
        omsAgent: {
            enabled: true,
            logAnalyticsWorkspaceId: logAnalytics.id
        }
    }
})

export const adSpPasswordValue = adSpPassword.value
export const kubeconfig = krustletCluster.kubeConfigRaw
