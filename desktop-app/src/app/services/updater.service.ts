import {Injectable} from '@angular/core';
import {BsModalRef, BsModalService} from 'ngx-bootstrap/modal';
import {AppService} from './app.service';
import {environment} from '../../environments/environment';
import {UpdateDialogComponent} from '../components/shared/update-dialog/update-dialog.component';
import compareVersions from 'compare-versions';
import {WorkspaceService} from './workspace.service';
import {HttpClient} from '@angular/common/http';
import md from 'markdown-it';
import {ElectronService} from './electron.service';
import {constants} from '@noovolari/leapp-core/models/constants';
import { Repository } from '@noovolari/leapp-core/services/repository';

@Injectable({
  providedIn: 'root'
})
export class UpdaterService {

  version: string;
  releaseName: string;
  releaseDate: string;
  releaseNotes: string;
  bsModalRef: BsModalRef;
  markdown: any;

  constructor(
    private appService: AppService,
    private workspaceService: WorkspaceService,
    private bsModalService: BsModalService,
    private httpClient: HttpClient,
    private electronService: ElectronService
  ) {
    this.markdown = md();
  }

  isUpdateNeeded(): boolean {
    const currentSavedVersion = this.getSavedAppVersion();
    const updateVersion = this.version;
    return compareVersions(updateVersion, currentSavedVersion) > 0;
  }

  getCurrentAppVersion(): string {
    return this.electronService.app.getVersion();
  }

  getSavedAppVersion(): string {
    return this.electronService.fs.readFileSync(this.electronService.os.homedir() + `/.Leapp/.latest.json`).toString();
  }

  getSavedVersionComparison(): boolean {
    return compareVersions(this.getSavedAppVersion(), this.getCurrentAppVersion()) > 0;
  }

  setUpdateInfo(version: string, releaseName: string, releaseDate: string, releaseNotes: string): void {
    this.version = version;
    this.releaseName = releaseName;
    this.releaseDate = releaseDate;
    this.releaseNotes = releaseNotes;

    this.workspaceService.sessions = [...this.workspaceService.sessions];
    Repository.getInstance().updateSessions(this.workspaceService.sessions);
  }

  updateDialog(): void {
    if (!this.bsModalRef) {
      for (let i = 1; i <= this.bsModalService.getModalsCount(); i++) {
        this.bsModalService.hide(i);
      }

      const callback = (event) => {
        if (event === constants.confirmClosedAndIgnoreUpdate) {
          this.updateVersionJson(this.version);
          this.workspaceService.sessions = [...this.workspaceService.sessions];
          Repository.getInstance().updateSessions(this.workspaceService.sessions);
        } else if (event === constants.confirmCloseAndDownloadUpdate) {
          this.appService.openExternalUrl(`${environment.latestUrl}`);
        }
        this.bsModalRef = undefined;
      };

      this.appService.getCurrentWindow().show();
      this.bsModalRef = this.bsModalService.show(UpdateDialogComponent, {
        backdrop: 'static',
        animated: false,
        class: 'confirm-modal',
        initialState: { version: this.version, releaseDate: this.releaseDate, releaseNotes: this.releaseNotes, callback}
      });

    }
  }

  updateVersionJson(version: string): void {
    this.electronService.fs.writeFileSync(this.electronService.os.homedir() + '/.Leapp/.latest.json', version);
  }

  async getReleaseNote(): Promise<string> {
    return new Promise( (resolve, _) => {
        this.httpClient.get('https://asset.noovolari.com/CHANGELOG.md', { responseType: 'text' }).subscribe(data => {
          resolve(this.markdown.render(data));
        }, error => {
          console.log('error', error);
          resolve('');
        });
    });
  }

  isReady() {
    return (this.version !== undefined);
  }
}
