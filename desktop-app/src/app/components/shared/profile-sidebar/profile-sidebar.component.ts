import { Component, OnInit, Renderer2 } from '@angular/core'
import { AppService } from '../../../services/app.service'
import { Router } from '@angular/router'
import { HttpClient } from '@angular/common/http'
import { ExecuteService } from '../../../services/execute.service'
import { ProxyService } from '../../../services/proxy.service'
import { WorkspaceService } from '../../../services/workspace.service'
import { LoggerLevel, LoggingService } from '@noovolari/leapp-core/services/logging-service'
import { LeappCoreService } from '../../../services/leapp-core.service'

@Component({
  selector: 'app-profile-sidebar',
  templateUrl: './profile-sidebar.component.html',
  styleUrls: ['./profile-sidebar.component.scss']
})
export class ProfileSidebarComponent implements OnInit {
  private loggingService: LoggingService

  profileOpen = false
  test: any
  version

  constructor(private appService: AppService, private router: Router, private httpClient: HttpClient,
              private executeService: ExecuteService, private proxyService: ProxyService,
              private workspaceService: WorkspaceService, private renderer: Renderer2,
              private leappCoreService: LeappCoreService) {
    this.loggingService = leappCoreService.loggingService
  }

  /**
   * Init the profile sidebar using the event emitter status listener
   */
  ngOnInit() {
    this.version = this.appService.getApp().getVersion()

    this.appService.profileOpen.subscribe(res => {
      this.profileOpen = res
      if (this.profileOpen) {
        this.renderer.addClass(document.body, 'moved')
      } else {
        this.renderer.removeClass(document.body, 'moved')
      }
    })
  }

  /**
   * logout from Leapp
   */
  async logout() {
    await this.appService.logout()
  }

  closeProfile() {
    this.profileOpen = false
    this.appService.profileOpen.emit(false)
    this.loggingService.logger(`Profile open emitting: ${this.profileOpen}`, LoggerLevel.info, this)
    this.renderer.removeClass(document.body, 'moved')
  }

  goToProfile() {
    this.closeProfile()
    this.router.navigate(['/profile']).then(_ => {})
  }

  goToHome() {
    this.closeProfile()
    this.router.navigate(['/sessions', 'session-selected']).then(_ => {})
  }

  goToIdentityProvider() {
    this.closeProfile()
    this.router.navigate(['/', 'aws-sso']).then(_ => {})
  }
}
