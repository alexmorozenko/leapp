import SSO, {
  AccountInfo,
  GetRoleCredentialsRequest,
  GetRoleCredentialsResponse,
  ListAccountRolesRequest,
  ListAccountsRequest,
  LogoutRequest,
  RoleInfo
} from 'aws-sdk/clients/sso'

import { AwsSessionService } from './aws-session-service'
import { AwsSsoOidcService } from './aws-sso-oidc.service'
import { ISessionNotifier } from '../../../interfaces/i-session-notifier'
import { AwsSsoRoleSession } from '../../../models/aws-sso-role-session'
import { CredentialsInfo } from '../../../models/credentials-info'
import { Repository } from '../../repository'
import { FileService } from '../../file-service'
import { AwsCoreService } from '../../aws-core-service'
import { KeychainService } from '../../keychain-service'
import { SessionType } from '../../../models/session-type'
import { INativeService } from '../../../interfaces/i-native-service'
import { BrowserWindowClosing } from '../../../interfaces/i-browser-window-closing'

export interface AwsSsoRoleSessionRequest {
  sessionName: string;
  region: string;
  email: string;
  roleArn: string;
}

export interface GenerateSSOTokenResponse {
  accessToken: string;
  expirationTime: Date;
}

export interface LoginResponse {
  accessToken: string;
  region: string;
  expirationTime: Date;
  portalUrlUnrolled: string;
}

export interface RegisterClientResponse {
  clientId?: string;
  clientSecret?: string;
  clientIdIssuedAt?: number;
  clientSecretExpiresAt?: number;
}

export interface StartDeviceAuthorizationResponse {
  deviceCode?: string;
  expiresIn?: number;
  interval?: number;
  userCode?: string;
  verificationUri?: string;
  verificationUriComplete?: string;
}

export interface VerificationResponse {
  clientId: string;
  clientSecret: string;
  deviceCode: string;
}

export interface SsoRoleSession {
  sessionName: string;
  roleArn: string;
  email: string;
  region: string;
  profileId: string;
}

export class AwsSsoRoleService extends AwsSessionService implements BrowserWindowClosing {
  private ssoPortal: SSO

  public constructor(iSessionNotifier: ISessionNotifier, repository: Repository, private fileService: FileService,
                     private keyChainService: KeychainService, private awsCoreService: AwsCoreService,
                     private nativeService: INativeService, private awsSsoOidcService: AwsSsoOidcService,
                     private appName: string, private defaultRegion: string) {
    super(iSessionNotifier, repository)
    awsSsoOidcService.appendListener(this)
  }


  static sessionTokenFromGetSessionTokenResponse(getRoleCredentialResponse: SSO.GetRoleCredentialsResponse): { sessionToken: any } {
    return {
      sessionToken: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        aws_access_key_id: getRoleCredentialResponse.roleCredentials.accessKeyId.trim(),
        // eslint-disable-next-line @typescript-eslint/naming-convention
        aws_secret_access_key: getRoleCredentialResponse.roleCredentials.secretAccessKey.trim(),
        // eslint-disable-next-line @typescript-eslint/naming-convention
        aws_session_token: getRoleCredentialResponse.roleCredentials.sessionToken.trim(),
      }
    }
  }

  async catchClosingBrowserWindow(): Promise<void> {
    const sessions = this.iSessionNotifier.listAwsSsoRoles()
    for (let i = 0; i < sessions.length; i++) {
      // Stop session
      const currentSession = sessions[i]
      await this.stop(currentSession.sessionId).then(_ => {
      })
    }
  }

  create(accountRequest: AwsSsoRoleSessionRequest, profileId: string): void {
    const session = new AwsSsoRoleSession(accountRequest.sessionName, accountRequest.region, accountRequest.roleArn,
      profileId, accountRequest.email)
    this.iSessionNotifier.addSession(session)
  }

  async applyCredentials(sessionId: string, credentialsInfo: CredentialsInfo): Promise<void> {
    const session = this.iSessionNotifier.getSessionById(sessionId)
    const profileName = this.repository.getProfileName((session as AwsSsoRoleSession).profileId)
    const credentialObject = {}
    credentialObject[profileName] = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      aws_access_key_id: credentialsInfo.sessionToken.aws_access_key_id,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      aws_secret_access_key: credentialsInfo.sessionToken.aws_secret_access_key,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      aws_session_token: credentialsInfo.sessionToken.aws_session_token,
      region: session.region
    }
    return await this.fileService.iniWriteSync(this.awsCoreService.awsCredentialPath(), credentialObject)
  }

  async deApplyCredentials(sessionId: string): Promise<void> {
    const session = this.iSessionNotifier.getSessionById(sessionId)
    const profileName = this.repository.getProfileName((session as AwsSsoRoleSession).profileId)
    const credentialsFile = await this.fileService.iniParseSync(this.awsCoreService.awsCredentialPath())
    delete credentialsFile[profileName]
    await this.fileService.replaceWriteSync(this.awsCoreService.awsCredentialPath(), credentialsFile)
  }

  async generateCredentials(sessionId: string): Promise<CredentialsInfo> {
    const region = this.repository.getAwsSsoConfiguration().region
    const portalUrl = this.repository.getAwsSsoConfiguration().portalUrl
    const roleArn = (this.iSessionNotifier.getSessionById(sessionId) as AwsSsoRoleSession).roleArn

    const accessToken = await this.getAccessToken(region, portalUrl)
    const credentials = await this.getRoleCredentials(accessToken, region, roleArn)

    return AwsSsoRoleService.sessionTokenFromGetSessionTokenResponse(credentials)
  }

  sessionDeactivated(sessionId: string) {
    super.sessionDeactivated(sessionId)
  }

  removeSecrets(sessionId: string): void {
  }

  async sync(): Promise<SsoRoleSession[]> {
    const region = this.repository.getAwsSsoConfiguration().region
    const portalUrl = this.repository.getAwsSsoConfiguration().portalUrl

    const accessToken = await this.getAccessToken(region, portalUrl)

    // Get AWS SSO Role sessions
    const sessions = await this.getSessions(accessToken, region)

    // Remove all old AWS SSO Role sessions from workspace
    await this.removeSsoSessionsFromWorkspace()

    return sessions
  }

  async logout(): Promise<void> {
    // Obtain region and access token
    const region = this.repository.getAwsSsoConfiguration().region
    const savedAccessToken = await this.getAccessTokenFromKeychain()

    // Configure Sso Portal Client
    this.getSsoPortalClient(region)

    // Make a logout request to Sso
    const logoutRequest: LogoutRequest = {accessToken: savedAccessToken}

    this.ssoPortal.logout(logoutRequest).promise().then(_ => {
    }, _ => {
      // Clean clients
      this.ssoPortal = null

      // Delete access token and remove sso configuration info from workspace
      this.keyChainService.deletePassword(this.appName, 'aws-sso-access-token')
      this.repository.removeExpirationTimeFromAwsSsoConfiguration()

      this.removeSsoSessionsFromWorkspace()
    })
  }

  async getAccessToken(region: string, portalUrl: string): Promise<string> {
    if (this.ssoExpired()) {
      const loginResponse = await this.login(region, portalUrl)

      this.configureAwsSso(
        region,
        loginResponse.portalUrlUnrolled,
        loginResponse.expirationTime.toISOString(),
        loginResponse.accessToken
      )

      return loginResponse.accessToken
    } else {
      return await this.getAccessTokenFromKeychain()
    }
  }

  async getRoleCredentials(accessToken: string, region: string, roleArn: string): Promise<GetRoleCredentialsResponse> {
    this.getSsoPortalClient(region)

    const getRoleCredentialsRequest: GetRoleCredentialsRequest = {
      accountId: roleArn.substring(13, 25),
      roleName: roleArn.split('/')[1],
      accessToken
    }

    return this.ssoPortal.getRoleCredentials(getRoleCredentialsRequest).promise()
  }

  async awsSsoActive(): Promise<boolean> {
    const ssoToken = await this.getAccessTokenFromKeychain()
    return !this.ssoExpired() && ssoToken !== undefined
  }

  private ssoExpired(): boolean {
    const expirationTime = this.repository.getAwsSsoConfiguration().expirationTime
    return !expirationTime || Date.parse(expirationTime) < Date.now()
  }

  private async login(region: string, portalUrl: string): Promise<LoginResponse> {
    const redirectClient = this.nativeService.followRedirects[this.getProtocol(portalUrl)]
    portalUrl = await new Promise((resolve, _) => {
      const request = redirectClient.request(portalUrl, response => resolve(response.responseUrl))
      request.end()
    })

    const generateSsoTokenResponse = await this.awsSsoOidcService.login(region, portalUrl)
    return {
      portalUrlUnrolled: portalUrl,
      accessToken: generateSsoTokenResponse.accessToken,
      region,
      expirationTime: generateSsoTokenResponse.expirationTime
    }
  }

  private getProtocol(aliasedUrl: string): string {
    let protocol = aliasedUrl.split('://')[0]
    if (protocol.indexOf('http') === -1) {
      protocol = 'https'
    }
    return protocol
  }

  private async getSessions(accessToken: string, region: string): Promise<SsoRoleSession[]> {
    const accounts: AccountInfo[] = await this.listAccounts(accessToken, region)

    const promiseArray: Promise<SsoRoleSession[]>[] = []

    accounts.forEach((account) => {
      promiseArray.push(this.getSessionsFromAccount(account, accessToken, region))
    })

    return new Promise((resolve, _) => {
      Promise.all(promiseArray).then((sessionMatrix: SsoRoleSession[][]) => {
        resolve(sessionMatrix.flat())
      })
    })
  }

  private async getSessionsFromAccount(accountInfo: AccountInfo, accessToken: string, region: string): Promise<SsoRoleSession[]> {
    this.getSsoPortalClient(region)

    const listAccountRolesRequest: ListAccountRolesRequest = {
      accountId: accountInfo.accountId,
      accessToken,
      maxResults: 30 // TODO: find a proper value
    }

    const accountRoles: RoleInfo[] = []

    await new Promise((resolve, _) => {
      this.recursiveListRoles(accountRoles, listAccountRolesRequest, resolve)
    })

    const awsSsoSessions: SsoRoleSession[] = []

    accountRoles.forEach((accountRole) => {
      const oldSession = this.findOldSession(accountInfo, accountRole)

      const awsSsoSession = {
        email: accountInfo.emailAddress,
        region: oldSession?.region || this.repository.getDefaultRegion() || this.defaultRegion,
        roleArn: `arn:aws:iam::${accountInfo.accountId}/${accountRole.roleName}`,
        sessionName: accountInfo.accountName,
        profileId: oldSession?.profileId || this.repository.getDefaultProfileId()
      }

      awsSsoSessions.push(awsSsoSession)
    })

    return awsSsoSessions
  }

  private recursiveListRoles(accountRoles: RoleInfo[], listAccountRolesRequest: ListAccountRolesRequest, promiseCallback: any) {
    this.ssoPortal.listAccountRoles(listAccountRolesRequest).promise().then(response => {
      accountRoles.push(...response.roleList)

      if (response.nextToken !== null) {
        listAccountRolesRequest.nextToken = response.nextToken
        this.recursiveListRoles(accountRoles, listAccountRolesRequest, promiseCallback)
      } else {
        promiseCallback(accountRoles)
      }
    })
  }

  private async listAccounts(accessToken: string, region: string): Promise<AccountInfo[]> {
    this.getSsoPortalClient(region)

    const listAccountsRequest: ListAccountsRequest = {accessToken, maxResults: 30}
    const accountList: AccountInfo[] = []

    return new Promise((resolve, _) => {
      this.recursiveListAccounts(accountList, listAccountsRequest, resolve)
    })
  }

  private recursiveListAccounts(accountList: AccountInfo[], listAccountsRequest: ListAccountsRequest, promiseCallback: any) {
    this.ssoPortal.listAccounts(listAccountsRequest).promise().then(response => {
      accountList.push(...response.accountList)

      if (response.nextToken !== null) {
        listAccountsRequest.nextToken = response.nextToken
        this.recursiveListAccounts(accountList, listAccountsRequest, promiseCallback)
      } else {
        promiseCallback(accountList)
      }
    })
  }

  private async removeSsoSessionsFromWorkspace(): Promise<void> {
    const sessions = this.iSessionNotifier.listAwsSsoRoles()

    for (let i = 0; i < sessions.length; i++) {
      const sess = sessions[i]

      const iamRoleChainedSessions = this.iSessionNotifier.listIamRoleChained(sess)

      for (let j = 0; j < iamRoleChainedSessions.length; j++) {
        await this.delete(iamRoleChainedSessions[j].sessionId)
      }

      await this.stop(sess.sessionId)

      this.iSessionNotifier.deleteSession(sess.sessionId)
      this.repository.deleteSession(sess.sessionId)
    }
  }

  private configureAwsSso(region: string, portalUrl: string, expirationTime: string, accessToken: string) {
    this.repository.configureAwsSso(region, portalUrl, expirationTime)
    this.keyChainService.saveSecret(this.appName, 'aws-sso-access-token', accessToken).then(_ => {
    })
  }

  private getSsoPortalClient(region: string): void {
    if (!this.ssoPortal) {
      this.ssoPortal = new SSO({region})
    }
  }

  private async getAccessTokenFromKeychain(): Promise<string> {
    return this.keyChainService.getSecret(this.appName, 'aws-sso-access-token')
  }

  private findOldSession(accountInfo: SSO.AccountInfo, accountRole: SSO.RoleInfo): { region: string; profileId: string } {
    //TODO: use map and filter in order to make this method more readable
    for (let i = 0; i < this.iSessionNotifier.getSessions().length; i++) {
      const sess = this.iSessionNotifier.getSessions()[i]

      if (sess.type === SessionType.awsSsoRole) {
        if (
          ((sess as AwsSsoRoleSession).email === accountInfo.emailAddress) &&
          ((sess as AwsSsoRoleSession).roleArn === `arn:aws:iam::${accountInfo.accountId}/${accountRole.roleName}`)
        ) {
          return {region: (sess as AwsSsoRoleSession).region, profileId: (sess as AwsSsoRoleSession).profileId}
        }
      }
    }

    return undefined
  }
}
