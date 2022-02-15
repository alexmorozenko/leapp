import {Component, Input, OnInit, TemplateRef, ViewChild} from '@angular/core';
import {AppService} from '../../../services/app.service';
import {Router} from '@angular/router';
import {environment} from '../../../../environments/environment';
import * as uuid from 'uuid';
import {BsModalRef, BsModalService} from 'ngx-bootstrap/modal';
import {optionBarIds} from '../sessions.component';
import {MatMenuTrigger} from '@angular/material/menu';
import {IGlobalColumns} from '../../command-bar/command-bar.component';
import {EditDialogComponent} from '../../dialogs/edit-dialog/edit-dialog.component';
import { Session } from '@noovolari/leapp-core/models/session';
import {SessionType} from '@noovolari/leapp-core/models/session-type';
import {SessionStatus} from '@noovolari/leapp-core/models/session-status';
import {LeappCoreService} from '../../../services/leapp-core.service';
import {LoggerLevel, LoggingService} from '@noovolari/leapp-core/services/logging-service';
import {SessionFactory} from '@noovolari/leapp-core/services/session-factory';
import {SsmService} from '../../../services/ssm.service';
import {FileService} from '@noovolari/leapp-core/services/file-service';
import {KeychainService} from '@noovolari/leapp-core/services/keychain-service';
import {WorkspaceService} from '@noovolari/leapp-core/services/workspace-service';
import { SessionService } from '@noovolari/leapp-core/services/session/session-service';
import {AwsCoreService} from '@noovolari/leapp-core/services/aws-core-service';
import {AzureCoreService} from '@noovolari/leapp-core/services/azure-core-service';
import {Repository} from '@noovolari/leapp-core/services/repository';
import {constants} from '@noovolari/leapp-core/models/constants';
import {WindowService} from '../../../services/window.service';
import {AwsIamRoleFederatedSession} from '@noovolari/leapp-core/models/aws-iam-role-federated-session';
import {AwsIamUserService} from '@noovolari/leapp-core/services/session/aws/aws-iam-user-service';
import {MessageToasterService, ToastLevel} from '../../../services/message-toaster.service';
import {AwsSessionService} from '@noovolari/leapp-core/services/session/aws/aws-session-service';
import {LeappBaseError} from '@noovolari/leapp-core/errors/leapp-base-error';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'tr[app-session-card]',
  templateUrl: './session-card.component.html',
  styleUrls: ['./session-card.component.scss'],

})
export class SessionCardComponent implements OnInit {
  @Input ()
  menutriggers;

  @Input()
  session!: Session;

  @Input()
  compactMode!: boolean;

  @Input()
  globalColumns: IGlobalColumns;

  @ViewChild('ssmModalTemplate', { static: false })
  ssmModalTemplate: TemplateRef<any>;

  @ViewChild('defaultRegionModalTemplate', { static: false })
  defaultRegionModalTemplate: TemplateRef<any>;

  @ViewChild('defaultProfileModalTemplate', { static: false })
  defaultProfileModalTemplate: TemplateRef<any>;

  @ViewChild(MatMenuTrigger)
  trigger: MatMenuTrigger;


  eSessionType = SessionType;
  eSessionStatus = SessionStatus;
  eOptionIds = optionBarIds;

  modalRef: BsModalRef;

  ssmLoading = true;
  openSsm = false;
  firstTimeSsm = true;

  selectedSsmRegion;
  selectedDefaultRegion;
  awsRegions = [];
  regionOrLocations = [];
  instances = [];
  duplicateInstances = [];
  placeholder;
  selectedProfile: any;
  profiles: { id: string; name: string }[];

  menuX: number;
  menuY: number;

  repository: Repository;
  private loggingService: LoggingService;
  private sessionFactory: SessionFactory;
  private fileService: FileService;
  private keychainService: KeychainService;
  private workspaceService: WorkspaceService;
  private sessionService: SessionService;
  private awsCoreService: AwsCoreService;
  private azureCoreService: AzureCoreService;

  constructor(private appService: AppService,
              private router: Router,
              private bsModalService: BsModalService,
              private modalService: BsModalService,
              private ssmService: SsmService,
              private windowService: WindowService,
              private messageToasterService: MessageToasterService,
              private leappCoreService: LeappCoreService
  ) {
    this.loggingService = leappCoreService.loggingService;
    this.sessionFactory = leappCoreService.sessionFactory;
    this.fileService = leappCoreService.fileService;
    this.keychainService = leappCoreService.keyChainService;
    this.workspaceService = leappCoreService.workspaceService;
    this.repository = leappCoreService.repository;
    this.awsCoreService = leappCoreService.awsCoreService;
    this.azureCoreService = leappCoreService.azureCoreService;
  }

  ngOnInit() {
    // Retrieve the singleton service for the concrete implementation of SessionService
    this.sessionService = this.sessionFactory.getSessionService(this.session.type);

    // Set regions and locations
    this.awsRegions = this.awsCoreService.getRegions();
    const azureLocations = this.azureCoreService.getLocations();

    // Get profiles
    this.profiles = this.repository.getWorkspace().profiles;

    // Array and labels for regions and locations
    this.regionOrLocations = this.session.type !== SessionType.azure ? this.awsRegions : azureLocations;
    this.placeholder = this.session.type !== SessionType.azure ? 'Select a default region' : 'Select a default location';

    // Pre selected Region and Profile
    this.selectedDefaultRegion = this.session.region;
    this.selectedProfile = this.getProfileId(this.session);
  }

  /**
   * Used to call for start or stop depending on sessions status
   */
  switchCredentials() {
    if (this.session.status === SessionStatus.active) {
      this.stopSession();
    } else {
      this.startSession();
    }
  }

  openOptionBar(session: Session) {
    this.clearOptionIds();
    optionBarIds[session.sessionId] = true;
    document.querySelector('.sessions').classList.add('option-bar-opened');
  }

  /**
   * Start the selected sessions
   */
  startSession() {
    this.sessionService.start(this.session.sessionId).then((_) => {});
    this.logSessionData(this.session, `Starting Session`);
    this.trigger.closeMenu();
  }

  /**
   * Stop sessions
   */
  stopSession() {
    this.sessionService.stop(this.session.sessionId).then((_) => {});
    this.logSessionData(this.session, `Stopped Session`);
    this.trigger.closeMenu();
  }

  /**
   * Delete a sessions from the workspace
   *
   * @param session - the sessions to remove
   * @param event - for stopping propagation bubbles
   */
  deleteSession(session, event) {
    event.preventDefault();
    event.stopPropagation();
    this.trigger.closeMenu();

    const dialogMessage = this.generateDeleteDialogMessage(session);

    this.windowService.confirmDialog(dialogMessage, (status) => {
      if (status === constants.confirmed) {
        this.sessionService.delete(session.sessionId).then((_) => {});
        this.logSessionData(session, 'Session Deleted');
        this.clearOptionIds();
      }
    }, 'Delete Session', 'Cancel');
  }

  /**
   * Edit Session
   *
   * @param session - the sessions to edit
   * @param event - to remove propagation bubbles
   */
  editSession(session: Session, event) {
    this.clearOptionIds();
    event.preventDefault();
    event.stopPropagation();
    this.trigger.closeMenu();

    this.bsModalService.show(EditDialogComponent, { animated: false, class: 'edit-modal', initialState: { selectedSessionId: session.sessionId }});
  }

  /**
   * Copy credentials in the clipboard
   */
  async copyCredentials(session: Session, type: number, event) {
    event.preventDefault();
    event.stopPropagation();
    this.trigger.closeMenu();

    try {
      const workspace = this.repository.getWorkspace();
      if (workspace) {
        const texts = {
          1: (session as AwsIamRoleFederatedSession).roleArn ? `${(session as AwsIamRoleFederatedSession).roleArn.split('/')[0].substring(13, 25)}` : '',
          2: (session as AwsIamRoleFederatedSession).roleArn ? `${(session as AwsIamRoleFederatedSession).roleArn}` : ''
        };

        let text = texts[type];

        // Special conditions for IAM Users
        if (session.type === SessionType.awsIamUser) {
          // Get Account from Caller Identity
          text = await (this.sessionService as AwsIamUserService).getAccountNumberFromCallerIdentity(session);
        }

        this.appService.copyToClipboard(text);
        this.messageToasterService.toast('Your information have been successfully copied!', ToastLevel.success, 'Information copied!');
      }
    } catch (err) {
      this.messageToasterService.toast(err, ToastLevel.warn);
      this.loggingService.logger(err, LoggerLevel.error, this, err.stack);
    }
  }

  // ============================== //
  // ========== SSM AREA ========== //
  // ============================== //
  addNewProfile(tag: string) {
    return {id: uuid.v4(), name: tag};
  }

  /**
   * SSM Modal open given the correct sessions
   *
   * @param session - the sessions to check for possible ssm sessions
   */
  ssmModalOpen(event, session) {
    event.preventDefault();
    event.stopPropagation();
    this.trigger.closeMenu();

    // Reset things before opening the modal
    this.instances = [];
    this.ssmLoading = false;
    this.firstTimeSsm = true;
    this.selectedSsmRegion = null;
    this.modalRef = this.modalService.show(this.ssmModalTemplate, { class: 'ssm-modal'});
  }

  /**
   * SSM Modal open given the correct sessions
   *
   * @param session - the sessions to check for possible ssm sessions
   */
  changeRegionModalOpen(event, session) {
    event.preventDefault();
    event.stopPropagation();
    this.trigger.closeMenu();

    // open the modal
    this.modalRef = this.modalService.show(this.defaultRegionModalTemplate, { class: 'ssm-modal'});
  }

  /**
   * Set the region for ssm init and launch the mopethod form the server to find instances
   *
   * @param event - the change select event
   * @param session - The sessions in which the aws region need to change
   */
  async changeSsmRegion(event, session: Session) {

    // We have a valid SSM region
    if (this.selectedSsmRegion) {
      // Start process
      this.ssmLoading = true;
      this.firstTimeSsm = true;
      // Generate valid temporary credentials for the SSM and EC2 client
      const credentials = await (this.sessionService as AwsSessionService).generateCredentials(session.sessionId);
      // Get the instances
      try {
        this.instances = await this.ssmService.getSsmInstances(credentials, this.selectedSsmRegion);
        this.duplicateInstances = this.instances;
      } catch(err) {
        throw new LeappBaseError('SSM Error', this, LoggerLevel.error, err.message);
      } finally {
        this.ssmLoading = false;
        this.firstTimeSsm = false;
      }
    }
  }

  /**
   * Set the region for the sessions
   */
  async changeRegion() { // TODO: Use the brand new RegionService
    if (this.selectedDefaultRegion) {
      let wasActive = false;

      if (this.session.status === SessionStatus.active) {
        // Stop temporary if the sessions is active
        await this.sessionService.stop(this.session.sessionId);
        wasActive = true;
      }

      const sessions: Session[] = this.repository.getSessions();
      for(let i = 0; i < sessions.length; i++) {
        if (sessions[i].sessionId === this.session.sessionId) {
          sessions[i].region = this.selectedDefaultRegion;
        }
      }
      this.repository.updateSessions(sessions);

      this.session.region = this.selectedDefaultRegion;
      this.workspaceService.updateSession(this.session.sessionId, this.session);

      if (wasActive) {
        this.startSession();
      }

      this.messageToasterService.toast('Default region has been changed!', ToastLevel.success, 'Region changed!');
      this.modalRef.hide();
    }
  }

  /**
   * Start a new ssm sessions
   *
   * @param sessionId - id of the sessions
   * @param instanceId - instance id to start ssm sessions
   */
  async startSsmSession(sessionId, instanceId) {
    this.instances.forEach((instance) => {
     if (instance.InstanceId === instanceId) {
       instance.loading = true;
     }
    });

    // Generate valid temporary credentials for the SSM and EC2 client
    const credentials = await (this.sessionService as AwsSessionService).generateCredentials(sessionId);

    this.ssmService.startSession(credentials, instanceId, this.selectedSsmRegion);

    setTimeout(() => {
      this.instances.forEach((instance) => {
       if (instance.InstanceId === instanceId) {
          instance.loading = false;
       }
      });
    }, 4000);

    this.openSsm = false;
    this.ssmLoading = false;
  }

  searchSSMInstance(event) {
    if (event.target.value !== '') {
      this.instances = this.duplicateInstances.filter((i) =>
                                 i.InstanceId.indexOf(event.target.value) > -1 ||
                                 i.IPAddress.indexOf(event.target.value) > -1 ||
                                 i.Name.indexOf(event.target.value) > -1);
    } else {
      this.instances = this.duplicateInstances;
    }
  }

  getProfileId(session: Session): string {
    if(session.type !== SessionType.azure) {
      return (session as any).profileId;
    } else {
      return undefined;
    }
  }

  getProfileName(profileId: string): string {
    const profileName = this.repository.getProfileName(profileId);
    return profileName ? profileName : constants.defaultAwsProfileName;
  }

  async changeProfile() {
    if (this.selectedProfile) {
      let wasActive = false;

      if(!this.repository.getProfileName(this.selectedProfile.id)) {
        this.repository.addProfile(this.selectedProfile);
      }

      if (this.session.status === SessionStatus.active) {
        await this.sessionService.stop(this.session.sessionId);
        wasActive = true;
      }

      const sessions: Session[] = this.repository.getSessions();
      for(let i = 0; i < sessions.length; i++) {
        if (sessions[i].sessionId === this.session.sessionId) {
          (sessions[i] as any).profileId = this.selectedProfile.id;
        }
      }
      this.repository.updateSessions(sessions);

      (this.session as any).profileId = this.selectedProfile.id;
      this.workspaceService.updateSession(this.session.sessionId, this.session);

      if (wasActive) {
        this.startSession();
      }

      this.messageToasterService.toast('Profile has been changed!', ToastLevel.success, 'Profile changed!');
      this.modalRef.hide();
    }
  }

  changeProfileModalOpen(event) {
    event.preventDefault();
    event.stopPropagation();
    this.trigger.closeMenu();
    this.selectedProfile = null;
    this.modalRef = this.modalService.show(this.defaultProfileModalTemplate, { class: 'ssm-modal'});
  }

  goBack() {
    this.modalRef.hide();
  }

  getIcon(session: Session) {
    const iconName = this.getProfileName(this.getProfileId(session)) === constants.defaultAwsProfileName ? 'home' : 'user';
    return session.status === SessionStatus.active ? `${iconName} orange` : iconName;
  }

  getSessionTypeIcon(type: SessionType) {
    return type === SessionType.azure ? 'azure' : 'aws';
  }

  getSessionProviderClass(type: SessionType) {
    switch (type) {
      case SessionType.azure: return 'blue';
      case SessionType.awsIamUser: return 'orange';
      case SessionType.awsSsoRole: return 'red';
      case SessionType.awsIamRoleFederated: return 'green';
      case SessionType.awsIamRoleChained: return 'purple';
    }
  }

  getSessionProviderLabel(type: SessionType) {
    switch (type) {
      case SessionType.azure: return 'Azure';
      case SessionType.awsIamUser: return 'IAM User';
      case SessionType.awsSsoRole: return 'AWS Single Sign-On';
      case SessionType.awsIamRoleFederated: return 'IAM Role Federated';
      case SessionType.awsIamRoleChained: return 'IAM Role Chained';
    }
  }

  copyProfile(profileName: string) {
    this.appService.copyToClipboard(profileName);
    this.messageToasterService.toast('Profile name copied!', ToastLevel.success, 'Information copied!');
    this.trigger.closeMenu();
  }

  openContextMenu(event, session) {
    this.appService.closeAllMenuTriggers();

    setTimeout(() => {
      this.menuY = event.layerY - 10;
      this.menuX = event.layerX - 10;

      this.trigger.openMenu();
      this.appService.setMenuTrigger(this.trigger);
    }, 100);
  }



  pinSession(session: Session, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.workspaceService.pinSession(session);
    this.trigger.closeMenu();
  }

  unpinSession(session: Session, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.workspaceService.unpinSession(session);
    this.trigger.closeMenu();
  }

  clearOptionIds() {
    for (const prop of Object.getOwnPropertyNames(optionBarIds)) {
      optionBarIds[prop] = false;
    }
    document.querySelector('.sessions').classList.remove('option-bar-opened');
  }

  openAmazonConsole(event: MouseEvent, session: Session) {
    event.preventDefault();
    event.stopPropagation();
    this.trigger.closeMenu();
  }

  openTerminal(event: MouseEvent, session: Session) {
    event.preventDefault();
    event.stopPropagation();
    this.trigger.closeMenu();
  }

  private logSessionData(session: Session, message: string): void {
    this.loggingService.logger(
      message,
      LoggerLevel.info,
      this,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        id: session.sessionId,
        account: session.sessionName,
        type: session.type
      }, null, 3));
  }

  private generateDeleteDialogMessage(session: Session): string {
    let iamRoleChainedSessions = [];
    if (session.type !== SessionType.azure) {
      iamRoleChainedSessions = this.repository.listIamRoleChained(session);
    }

    let iamRoleChainedSessionString = '';
    iamRoleChainedSessions.forEach((sess) => {
      iamRoleChainedSessionString += `<li><div class="removed-sessions"><b>${sess.sessionName}</b></div></li>`;
    });
    if (iamRoleChainedSessionString !== '') {
      return 'This sessions has iamRoleChained sessions: <br><ul>' +
        iamRoleChainedSessionString +
        '</ul><br>Removing the sessions will also remove the iamRoleChained sessions associated with it. Do you want to proceed?';
    } else {
      return 'Do you really want to delete this session?';
    }
  }
}
