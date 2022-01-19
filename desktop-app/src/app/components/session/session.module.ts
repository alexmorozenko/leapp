import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { SessionRoutingModule } from './session-routing.module'
import { SessionComponent } from './session/session.component'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { SharedModule } from '../shared/shared.module'
import { NgSelectModule } from '@ng-select/ng-select'
import { SessionCardComponent } from './session-card/session-card.component'
import { InfiniteScrollModule } from 'ngx-infinite-scroll'
import { TooltipModule } from 'ngx-bootstrap/tooltip'
import { BsDropdownModule } from 'ngx-bootstrap/dropdown'
import { FilteringPipe } from './session/filtering.pipe'
import { OrderingPipe } from './session/ordering.pipe'
import { DetailPipe } from './session-card/detail.pipe'
import { QueryingPipe } from './session/querying.pipe'

@NgModule({
  declarations: [
    SessionComponent,
    SessionCardComponent,
    FilteringPipe,
    OrderingPipe,
    QueryingPipe,
    DetailPipe
  ],
  imports: [
    CommonModule,
    SessionRoutingModule,
    SharedModule,
    FormsModule,
    NgSelectModule,
    ReactiveFormsModule,
    TooltipModule.forRoot(),
    BsDropdownModule.forRoot(),
    InfiniteScrollModule
  ]
})
export class SessionModule {}
