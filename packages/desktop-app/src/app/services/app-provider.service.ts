import { Injectable, NgZone } from "@angular/core";
import { AwsSamlAssertionExtractionService } from "@noovolari/leapp-core/services/aws-saml-assertion-extraction-service";
import { RemoteProceduresServer } from "@noovolari/leapp-core/services/remote-procedures-server";
import { AwsIamUserService } from "@noovolari/leapp-core/services/session/aws/aws-iam-user-service";
import { FileService } from "@noovolari/leapp-core/services/file-service";
import { KeychainService } from "@noovolari/leapp-core/services/keychain-service";
import { AwsCoreService } from "@noovolari/leapp-core/services/aws-core-service";
import { LogService } from "@noovolari/leapp-core/services/log-service";
import { TimerService } from "@noovolari/leapp-core/services/timer-service";
import { AwsIamRoleFederatedService } from "@noovolari/leapp-core/services/session/aws/aws-iam-role-federated-service";
import { AzureService } from "@noovolari/leapp-core/services/session/azure/azure-service";
import { AppNativeService } from "./app-native.service";
import { AppMfaCodePromptService } from "./app-mfa-code-prompt.service";
import { ExecuteService } from "@noovolari/leapp-core/services/execute-service";
import { RetroCompatibilityService } from "@noovolari/leapp-core/services/retro-compatibility-service";
import { AppAwsAuthenticationService } from "./app-aws-authentication.service";
import { AwsParentSessionFactory } from "@noovolari/leapp-core/services/session/aws/aws-parent-session.factory";
import { AwsIamRoleChainedService } from "@noovolari/leapp-core/services/session/aws/aws-iam-role-chained-service";
import { Repository } from "@noovolari/leapp-core/services/repository";
import { AwsSsoRoleService } from "@noovolari/leapp-core/services/session/aws/aws-sso-role-service";
import { AwsSsoOidcService } from "@noovolari/leapp-core/services/aws-sso-oidc.service";
import { AppVerificationWindowService } from "./app-verification-window.service";
import { BehaviouralSubjectService } from "@noovolari/leapp-core/services/behavioural-subject-service";
import { SessionFactory } from "@noovolari/leapp-core/services/session-factory";
import { RotationService } from "@noovolari/leapp-core/services/rotation-service";
import { AzureCoreService } from "@noovolari/leapp-core/services/azure-core-service";
import { constants } from "@noovolari/leapp-core/models/constants";
import { AwsSsoIntegrationService } from "@noovolari/leapp-core/services/aws-sso-integration-service";
import { WebConsoleService } from "@noovolari/leapp-core/services/web-console-service";
import { WindowService } from "./window.service";
import { SsmService } from "@noovolari/leapp-core/services/ssm-service";
import { IdpUrlsService } from "@noovolari/leapp-core/services/idp-urls-service";
import { NamedProfilesService } from "@noovolari/leapp-core/services/named-profiles-service";
import { SegmentService } from "@noovolari/leapp-core/services/segment-service";
import { SessionManagementService } from "@noovolari/leapp-core/services/session-management-service";
import { WorkspaceService } from "@noovolari/leapp-core/services/workspace-service";
import { AppNativeLoggerService } from "./app-native-logger-service";
import { MessageToasterService } from "./message-toaster.service";

@Injectable({
  providedIn: "root",
})
export class AppProviderService {
  // Injected by app.component
  mfaCodePrompter: AppMfaCodePromptService;
  awsAuthenticationService: AppAwsAuthenticationService;
  verificationWindowService: AppVerificationWindowService;
  windowService: WindowService;

  private behaviouralSubjectServiceInstance: BehaviouralSubjectService;
  private awsIamUserServiceInstance: AwsIamUserService;
  private awsIamRoleFederatedServiceInstance: AwsIamRoleFederatedService;
  private awsIamRoleChainedServiceInstance: AwsIamRoleChainedService;
  private awsSsoRoleServiceInstance: AwsSsoRoleService;
  private awsSsoIntegrationServiceInstance: AwsSsoIntegrationService;
  private awsSsoOidcServiceInstance: AwsSsoOidcService;
  private awsCoreServiceInstance: AwsCoreService;
  private azureServiceInstance: AzureService;
  private authenticationServiceInstance: AwsSamlAssertionExtractionService;
  private sessionFactoryInstance: SessionFactory;
  private awsParentSessionFactoryInstance: AwsParentSessionFactory;
  private fileServiceInstance: FileService;
  private repositoryInstance: Repository;
  private keyChainServiceInstance: KeychainService;
  private loggingServiceInstance: LogService;
  private timerServiceInstance: TimerService;
  private executeServiceInstance: ExecuteService;
  private rotationServiceInstance: RotationService;
  private retroCompatibilityServiceInstance: RetroCompatibilityService;
  private azureCoreServiceInstance: AzureCoreService;
  private webConsoleServiceInstance: WebConsoleService;
  private ssmServiceInstance: SsmService;
  private idpUrlServiceInstance: IdpUrlsService;
  private namedProfileInstance: NamedProfilesService;
  private remoteProceduresServerInstance: RemoteProceduresServer;
  private segmentServiceInstance: SegmentService;
  private sessionManagementServiceInstance: SessionManagementService;
  private workspaceServiceInstance: WorkspaceService;

  constructor(private electronService: AppNativeService, private messageToaster: MessageToasterService, private ngZone: NgZone) {}

  public get workspaceService(): WorkspaceService {
    if (!this.workspaceServiceInstance) {
      this.workspaceServiceInstance = new WorkspaceService(this.repository);
    }
    return this.workspaceServiceInstance;
  }

  public get segmentService(): SegmentService {
    if (!this.segmentServiceInstance) {
      this.segmentServiceInstance = new SegmentService(this.repository);
    }
    return this.segmentServiceInstance;
  }

  public get sessionManagementService(): SessionManagementService {
    if (!this.sessionManagementServiceInstance) {
      this.sessionManagementServiceInstance = new SessionManagementService(this.repository);
    }
    return this.sessionManagementServiceInstance;
  }

  public get idpUrlService(): IdpUrlsService {
    if (!this.idpUrlServiceInstance) {
      this.idpUrlServiceInstance = new IdpUrlsService(this.sessionFactory, this.repository);
    }
    return this.idpUrlServiceInstance;
  }

  public get namedProfileService(): NamedProfilesService {
    if (!this.namedProfileInstance) {
      this.namedProfileInstance = new NamedProfilesService(this.sessionFactory, this.repository, this.behaviouralSubjectService);
    }
    return this.namedProfileInstance;
  }

  public get webConsoleService(): WebConsoleService {
    if (!this.webConsoleServiceInstance) {
      this.webConsoleServiceInstance = new WebConsoleService(this.windowService, this.logService, window.fetch.bind(window));
    }
    return this.webConsoleServiceInstance;
  }

  public get behaviouralSubjectService(): BehaviouralSubjectService {
    if (!this.behaviouralSubjectServiceInstance) {
      this.behaviouralSubjectServiceInstance = new BehaviouralSubjectService(this.repository);
    }
    return this.behaviouralSubjectServiceInstance;
  }

  public get awsIamUserService(): AwsIamUserService {
    if (!this.awsIamUserServiceInstance) {
      this.awsIamUserServiceInstance = new AwsIamUserService(
        this.behaviouralSubjectService,
        this.repository,
        this.mfaCodePrompter,
        this.mfaCodePrompter,
        this.keyChainService,
        this.fileService,
        this.awsCoreService
      );
    }
    return this.awsIamUserServiceInstance;
  }

  public get awsIamRoleFederatedService(): AwsIamRoleFederatedService {
    if (!this.awsIamRoleFederatedServiceInstance) {
      this.awsIamRoleFederatedServiceInstance = new AwsIamRoleFederatedService(
        this.behaviouralSubjectService,
        this.repository,
        this.fileService,
        this.awsCoreService,
        this.awsAuthenticationService,
        constants.samlRoleSessionDuration
      );
    }
    return this.awsIamRoleFederatedServiceInstance;
  }

  public get awsIamRoleChainedService(): AwsIamRoleChainedService {
    if (!this.awsIamRoleChainedServiceInstance) {
      this.awsIamRoleChainedServiceInstance = new AwsIamRoleChainedService(
        this.behaviouralSubjectService,
        this.repository,
        this.awsCoreService,
        this.fileService,
        this.awsIamUserService,
        this.awsParentSessionFactory
      );
    }
    return this.awsIamRoleChainedServiceInstance;
  }

  public get awsSsoIntegrationService(): AwsSsoIntegrationService {
    if (!this.awsSsoIntegrationServiceInstance) {
      this.awsSsoIntegrationServiceInstance = new AwsSsoIntegrationService(
        this.repository,
        this.awsSsoOidcService,
        this.awsSsoRoleService,
        this.keyChainService,
        this.behaviouralSubjectService,
        this.electronService,
        this.sessionFactory,
        this.behaviouralSubjectService
      );
    }
    return this.awsSsoIntegrationServiceInstance;
  }

  public get awsSsoRoleService(): AwsSsoRoleService {
    if (!this.awsSsoRoleServiceInstance) {
      this.awsSsoRoleServiceInstance = new AwsSsoRoleService(
        this.behaviouralSubjectService,
        this.repository,
        this.fileService,
        this.keyChainService,
        this.awsCoreService,
        this.electronService,
        this.awsSsoOidcService
      );
    }
    return this.awsSsoRoleServiceInstance;
  }

  public get awsSsoOidcService(): AwsSsoOidcService {
    if (!this.awsSsoOidcServiceInstance) {
      this.awsSsoOidcServiceInstance = new AwsSsoOidcService(this.verificationWindowService, this.repository);
    }
    return this.awsSsoOidcServiceInstance;
  }

  public get awsCoreService(): AwsCoreService {
    if (!this.awsCoreServiceInstance) {
      this.awsCoreServiceInstance = new AwsCoreService(this.electronService, this.logService);
    }
    return this.awsCoreServiceInstance;
  }

  public get azureService(): AzureService {
    if (!this.azureServiceInstance) {
      this.azureServiceInstance = new AzureService(
        this.behaviouralSubjectService,
        this.repository,
        this.fileService,
        this.executeService,
        constants.azureAccessTokens
      );
    }

    return this.azureServiceInstance;
  }

  public get authenticationService(): AwsSamlAssertionExtractionService {
    if (!this.authenticationServiceInstance) {
      this.authenticationServiceInstance = new AwsSamlAssertionExtractionService();
    }
    return this.authenticationServiceInstance;
  }

  public get sessionFactory(): SessionFactory {
    if (!this.sessionFactoryInstance) {
      this.sessionFactoryInstance = new SessionFactory(
        this.awsIamUserService,
        this.awsIamRoleFederatedService,
        this.awsIamRoleChainedService,
        this.awsSsoRoleService,
        this.azureService
      );
    }
    return this.sessionFactoryInstance;
  }

  public get ssmService(): SsmService {
    if (!this.ssmServiceInstance) {
      this.ssmServiceInstance = new SsmService(this.logService, this.executeService);
    }
    return this.ssmServiceInstance;
  }

  public get awsParentSessionFactory(): AwsParentSessionFactory {
    if (!this.awsParentSessionFactoryInstance) {
      this.awsParentSessionFactoryInstance = new AwsParentSessionFactory(
        this.awsIamUserService,
        this.awsIamRoleFederatedService,
        this.awsSsoRoleService
      );
    }
    return this.awsParentSessionFactoryInstance;
  }

  public get fileService(): FileService {
    if (!this.fileServiceInstance) {
      this.fileServiceInstance = new FileService(this.electronService);
    }
    return this.fileServiceInstance;
  }

  public get repository(): Repository {
    if (!this.repositoryInstance) {
      this.repositoryInstance = new Repository(this.electronService, this.fileService);
    }
    return this.repositoryInstance;
  }

  public get keyChainService(): KeychainService {
    if (!this.keyChainServiceInstance) {
      this.keyChainServiceInstance = new KeychainService(this.electronService);
    }
    return this.keyChainServiceInstance;
  }

  public get logService(): LogService {
    if (!this.loggingServiceInstance) {
      this.loggingServiceInstance = new LogService(new AppNativeLoggerService(this.electronService, this.messageToaster));
    }
    return this.loggingServiceInstance;
  }

  public get timerService(): TimerService {
    if (!this.timerServiceInstance) {
      this.timerServiceInstance = new TimerService();
    }
    return this.timerServiceInstance;
  }

  public get executeService(): ExecuteService {
    if (!this.executeServiceInstance) {
      this.executeServiceInstance = new ExecuteService(this.electronService, this.repository, this.logService);
    }
    return this.executeServiceInstance;
  }

  public get rotationService(): RotationService {
    if (!this.rotationServiceInstance) {
      this.rotationServiceInstance = new RotationService(this.sessionFactory, this.repository);
    }
    return this.rotationServiceInstance;
  }

  public get retroCompatibilityService(): RetroCompatibilityService {
    if (!this.retroCompatibilityServiceInstance) {
      this.retroCompatibilityServiceInstance = new RetroCompatibilityService(
        this.fileService,
        this.keyChainService,
        this.repository,
        this.behaviouralSubjectService,
        constants.appName
      );
    }
    return this.retroCompatibilityServiceInstance;
  }

  public get azureCoreService(): AzureCoreService {
    if (!this.azureCoreServiceInstance) {
      this.azureCoreServiceInstance = new AzureCoreService();
    }
    return this.azureCoreServiceInstance;
  }

  public get remoteProceduresServer(): RemoteProceduresServer {
    if (!this.remoteProceduresServerInstance) {
      this.remoteProceduresServerInstance = new RemoteProceduresServer(
        this.electronService,
        this.verificationWindowService,
        this.awsAuthenticationService,
        this.mfaCodePrompter,
        this.repository,
        this.behaviouralSubjectService,
        (uiSafeBlock) => this.ngZone.run(() => uiSafeBlock())
      );
    }
    return this.remoteProceduresServerInstance;
  }
}
