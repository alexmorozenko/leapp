"use strict";
// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.
Object.defineProperty(exports, "__esModule", { value: true });
exports.environment = void 0;
var environment = {
    appName: 'Leapp',
    samlRoleSessionDuration: 3600,
    sessionDuration: 1200,
    sessionTokenDuration: 36000,
    timeout: 10000,
    lockFileDestination: '.Leapp/Leapp-lock.json',
    production: false,
    credentialsDestination: '.aws/credentials',
    azureAccessTokens: '.azure/accessTokens.json',
    azureProfile: '.azure/azureProfile.json',
    defaultRegion: 'us-east-1',
    defaultLocation: 'eastus',
    defaultAwsProfileName: 'default',
    defaultAzureProfileName: 'default-azure',
    latestUrl: 'https://leapp.cloud/releases.html'
};
exports.environment = environment;
//# sourceMappingURL=environment.js.map