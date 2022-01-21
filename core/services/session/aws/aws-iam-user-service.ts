import { CredentialsInfo } from '../../../models/credentials-info'
import { AwsIamUserSession } from '../../../models/aws-iam-user-session'
import { KeychainService } from '../../keychain-service'
import { Session } from '../../../models/session'
import * as AWS from 'aws-sdk'
import { GetSessionTokenResponse } from 'aws-sdk/clients/sts'
import { constants } from '../../../models/constants'
import { LeappAwsStsError } from '../../../errors/leapp-aws-sts-error'
import { LeappParseError } from '../../../errors/leapp-parse-error'
import { LeappMissingMfaTokenError } from '../../../errors/leapp-missing-mfa-token-error'
import { FileService } from '../../file-service'
import { AwsSessionService } from './aws-session-service'
import { AwsCoreService } from '../../aws-core-service'
import { ISessionNotifier } from '../../../interfaces/i-session-notifier'
import { LeappNotFoundError } from '../../../errors/leapp-not-found-error'
import { Credentials } from '../../../models/credentials'
import { Repository } from '../../repository'

export interface AwsIamUserSessionRequest {
  accountName: string;
  accessKey: string;
  secretKey: string;
  region: string;
  mfaDevice?: string;
}

export interface GenerateSessionTokenCallingMfaParams {
  DurationSeconds: number;
  SerialNumber?: string;
  TokenCode?: string;
}

export interface IMfaCodePrompter {
  promptForMFACode(sessionName: string, callback: any): void;
}

export class AwsIamUserService extends AwsSessionService {

  constructor(iSessionNotifier: ISessionNotifier, repository: Repository, private mfaCodePrompter: IMfaCodePrompter,
              private keychainService: KeychainService, private fileService: FileService,
              private awsCoreService: AwsCoreService) {
    super(iSessionNotifier, repository)
  }

  static isTokenExpired(tokenExpiration: string): boolean {
    const now = Date.now()
    return now > new Date(tokenExpiration).getTime()
  }

  static sessionTokenFromGetSessionTokenResponse(getSessionTokenResponse: GetSessionTokenResponse): { sessionToken: any } {
    if (getSessionTokenResponse.Credentials === undefined) {
      throw new LeappAwsStsError(this, 'an error occurred during session token generation.')
    }
    return {
      sessionToken: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        aws_access_key_id: getSessionTokenResponse.Credentials.AccessKeyId.trim(),
        // eslint-disable-next-line @typescript-eslint/naming-convention
        aws_secret_access_key: getSessionTokenResponse.Credentials.SecretAccessKey.trim(),
        // eslint-disable-next-line @typescript-eslint/naming-convention
        aws_session_token: getSessionTokenResponse.Credentials.SessionToken.trim(),
      }
    }
  }

  create(accountRequest: AwsIamUserSessionRequest, profileId: string): void {
    const session = new AwsIamUserSession(accountRequest.accountName, accountRequest.region, profileId, accountRequest.mfaDevice)

    this.keychainService.saveSecret(constants.appName, `${session.sessionId}-iam-user-aws-session-access-key-id`, accountRequest.accessKey)
      .then((_: any) => {
        this.keychainService.saveSecret(constants.appName, `${session.sessionId}-iam-user-aws-session-secret-access-key`, accountRequest.secretKey)
          .catch((err: any) => console.error(err))
      })
      .catch((err: any) => console.error(err))

    this.repository.addSession(session)
    this.iSessionNotifier?.addSession(session)
  }

  async applyCredentials(sessionId: string, credentialsInfo: CredentialsInfo): Promise<void> {
    const session = this.repository.getSessionById(sessionId)
    const profileName = this.repository.getProfileName((session as AwsIamUserSession).profileId)
    const credentialObject: { [key: string]: Credentials } = {}

    credentialObject[profileName] = {
      // eslint-disable-next-line @typescript-eslint/naming-convention,@typescript-eslint/naming-convention
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
    //const session = this.workspaceService.get(sessionId);
    const session = this.repository.getSessions().find(sess => sess.sessionId === sessionId)
    const profileName = this.repository.getProfileName((session as AwsIamUserSession).profileId)
    const credentialsFile = await this.fileService.iniParseSync(this.awsCoreService.awsCredentialPath())
    delete credentialsFile[profileName]
    return await this.fileService.replaceWriteSync(this.awsCoreService.awsCredentialPath(), credentialsFile)
  }

  async generateCredentials(sessionId: string): Promise<CredentialsInfo> {
    // Get the session in question
    //const session = this.workspaceService.get(sessionId);
    const session = this.repository.getSessions().find(sess => sess.sessionId === sessionId)

    if (session === undefined) {
      throw new LeappNotFoundError(this, `session with id ${sessionId} not found.`)
    }
    // Retrieve session token expiration
    const tokenExpiration = (session as AwsIamUserSession).sessionTokenExpiration
    // Check if token is expired
    if (!tokenExpiration || AwsIamUserService.isTokenExpired(tokenExpiration)) {
      // Token is Expired!
      // Retrieve access keys from keychain
      const accessKeyId = await this.getAccessKeyFromKeychain(sessionId)
      const secretAccessKey = await this.getSecretKeyFromKeychain(sessionId)
      // Get session token
      // https://docs.aws.amazon.com/STS/latest/APIReference/API_GetSessionToken.html
      AWS.config.update({accessKeyId, secretAccessKey})
      // Configure sts client options
      const sts = new AWS.STS(this.awsCoreService.stsOptions(session))
      // Configure sts get-session-token api call params
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const params = {DurationSeconds: constants.sessionTokenDuration}
      // Check if MFA is needed or not
      if ((session as AwsIamUserSession).mfaDevice) {
        // Return session token after calling MFA modal
        return this.generateSessionTokenCallingMfaModal(session, sts, params)
      } else {
        // Return session token in the form of CredentialsInfo
        return this.generateSessionToken(session, sts, params)
      }
    } else {
      // Session Token is NOT expired
      try {
        // Retrieve session token from keychain
        return JSON.parse(await this.keychainService.getSecret(constants.appName, `${session.sessionId}-iam-user-aws-session-token`))
      } catch (err: any) {
        throw new LeappParseError(this, err.message)
      }
    }
  }

  async getAccountNumberFromCallerIdentity(session: Session): Promise<string> {
    // Get credentials
    const credentials: CredentialsInfo = await this.generateCredentials(session.sessionId)
    AWS.config.update({
      accessKeyId: credentials.sessionToken.aws_access_key_id,
      secretAccessKey: credentials.sessionToken.aws_secret_access_key,
      sessionToken: credentials.sessionToken.aws_session_token
    })
    // Configure sts client options
    try {
      const sts = new AWS.STS(this.awsCoreService.stsOptions(session))
      const response = await sts.getCallerIdentity({}).promise()
      return response.Account ?? ''
    } catch (err: any) {
      throw new LeappAwsStsError(this, err.message)
    }
  }

  removeSecrets(sessionId: string): void {
    this.removeAccessKeyFromKeychain(sessionId).then(_ => {
      this.removeSecretKeyFromKeychain(sessionId).then(__ => {
        this.removeSessionTokenFromKeychain(sessionId).catch(err => {
          throw err
        })
      }).catch(err => {
        throw err
      })
    }).catch(err => {
      throw err
    })
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private generateSessionTokenCallingMfaModal(session: Session, sts: AWS.STS, params: GenerateSessionTokenCallingMfaParams): Promise<CredentialsInfo> {
    return new Promise((resolve, reject) => {
      // TODO: think about timeout management
      // TODO: handle condition in which mfaCodePrompter is null
      this.mfaCodePrompter.promptForMFACode(session.sessionName, (value: string) => {
        if (value !== constants.confirmClosed) {
          params.SerialNumber = (session as AwsIamUserSession).mfaDevice
          params.TokenCode = value
          // Return session token in the form of CredentialsInfo
          resolve(this.generateSessionToken(session, sts, params))
        } else {
          reject(new LeappMissingMfaTokenError(this, 'Missing Multi Factor Authentication code'))
        }
      })
    })
  }

  private async getAccessKeyFromKeychain(sessionId: string): Promise<string> {
    return await this.keychainService.getSecret(constants.appName, `${sessionId}-iam-user-aws-session-access-key-id`)
  }

  private async getSecretKeyFromKeychain(sessionId: string): Promise<string> {
    return await this.keychainService.getSecret(constants.appName, `${sessionId}-iam-user-aws-session-secret-access-key`)
  }

  private async removeAccessKeyFromKeychain(sessionId: string): Promise<void> {
    await this.keychainService.deletePassword(constants.appName, `${sessionId}-iam-user-aws-session-access-key-id`)
  }

  private async removeSecretKeyFromKeychain(sessionId: string): Promise<void> {
    await this.keychainService.deletePassword(constants.appName, `${sessionId}-iam-user-aws-session-secret-access-key`)
  }

  private async removeSessionTokenFromKeychain(sessionId: string): Promise<void> {
    await this.keychainService.deletePassword(constants.appName, `${sessionId}-iam-user-aws-session-token`)
  }

  private async generateSessionToken(session: Session, sts: AWS.STS, params: any): Promise<CredentialsInfo> {
    try {
      // Invoke sts get-session-token api
      const getSessionTokenResponse: GetSessionTokenResponse = await sts.getSessionToken(params).promise()

      // Save session token expiration
      this.saveSessionTokenResponseInTheSession(session, getSessionTokenResponse)

      // Generate correct object from session token response
      const sessionToken = AwsIamUserService.sessionTokenFromGetSessionTokenResponse(getSessionTokenResponse)

      // Save in keychain the session token
      await this.keychainService.saveSecret(constants.appName, `${session.sessionId}-iam-user-aws-session-token`, JSON.stringify(sessionToken))

      // Return Session Token
      return sessionToken
    } catch (err: any) {
      throw new LeappAwsStsError(this, err.message)
    }
  }

  private saveSessionTokenResponseInTheSession(session: Session, getSessionTokenResponse: AWS.STS.GetSessionTokenResponse): void {
    const sessions = this.repository.getSessions()
    const index = sessions.indexOf(session)
    const currentSession: Session = sessions[index]

    if (getSessionTokenResponse.Credentials !== undefined) {
      (currentSession as AwsIamUserSession).sessionTokenExpiration = getSessionTokenResponse.Credentials.Expiration.toISOString()
    }

    sessions[index] = currentSession

    this.repository.updateSessions(sessions)
    this.iSessionNotifier.setSessions([...sessions])
  }
}
