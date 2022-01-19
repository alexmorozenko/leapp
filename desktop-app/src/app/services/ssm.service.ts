import { Injectable } from '@angular/core'
import { AppService } from './app.service'
import { CredentialsInfo } from '@noovolari/leapp-core/models/credentials-info'
import { LeappBaseError } from '@noovolari/leapp-core/errors/leapp-base-error'
import { LoggerLevel, LoggingService } from '@noovolari/leapp-core/services/logging-service'
import { ExecuteService } from '@noovolari/leapp-core/services/execute.service'
import { LeappCoreService } from './leapp-core.service'

const AWS = require('aws-sdk')

@Injectable({
  providedIn: 'root'
})

//TODO: move into core module in near future
export class SsmService {
  private loggingService: LoggingService
  private executeService: ExecuteService
  ssmClient
  ec2Client

  constructor(private appService: AppService, leappCoreService: LeappCoreService) {
    this.loggingService = leappCoreService.loggingService
    this.executeService = leappCoreService.executeService
  }

  /**
   * Set the config for the SSM client
   *
   * @param data - the credential information
   * @param region - the region for the client
   */
  static setConfig(data: CredentialsInfo, region) {
    return {
      region,
      accessKeyId: data.sessionToken.aws_access_key_id,
      secretAccessKey: data.sessionToken.aws_secret_access_key,
      sessionToken: data.sessionToken.aws_session_token
    }
  }

  /**
   * Prepare the two clients and returns the available
   * ssm instances for the selected region
   *
   * @param credentials - pass the credentials object
   * @param region - pass the region where you want to make the request
   * @returns - {Observable<SsmResult>} - return the list of instances capable of SSM in the selected region
   */
  async getSsmInstances(credentials: CredentialsInfo, region): Promise<any> {
    // Set your SSM client and EC2 client

    AWS.config.update(SsmService.setConfig(credentials, region))
    this.ssmClient = new AWS.SSM()
    this.ec2Client = new AWS.EC2()

    // Fix for Ec2 clients from electron app
    //TODO: find a way to inject the origin header without using setFilteringForEc2Calls
    this.appService.setFilteringForEc2Calls()

    // Get Ssm instances info data
    const instances = await this.requestSsmInstances()
    return await this.applyEc2MetadataInformation(instances)
  }

  /**
   * Start a new ssm session given the instance id
   *
   * @param credentials - CredentialsInfo data from generate credentials method
   * @param instanceId - the instance id of the instance to start
   * @param region - aws System Manager start a session from a defined region
   */
  startSession(credentials: CredentialsInfo, instanceId, region) {
    const hypen = this.appService.getProcess().platform === 'darwin' ? '\'' : ''

    const env = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      AWS_ACCESS_KEY_ID: credentials.sessionToken.aws_access_key_id,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      AWS_SECRET_ACCESS_KEY: credentials.sessionToken.aws_secret_access_key,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      AWS_SESSION_TOKEN: credentials.sessionToken.aws_session_token
    }

    this.executeService.openTerminal(`aws ssm start-session --region ${region} --target ${hypen}${instanceId}${hypen}`, env).then(() => {
    }, err => {
      throw new LeappBaseError('Start SSM error', this, LoggerLevel.error, err.message)
    })
  }

  /**
   * Submit the request to do ssm to aws
   */
  private async requestSsmInstances(): Promise<any> {
    let instances = []

    try {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const describeInstanceInformationResponse = await this.ssmClient.describeInstanceInformation({MaxResults: 50}).promise()

      // Once we have obtained data from SSM and EC2, we verify the list are not empty
      if (describeInstanceInformationResponse['InstanceInformationList'] && describeInstanceInformationResponse['InstanceInformationList'].length > 0) {
        // Filter only the instances that are currently online
        instances = describeInstanceInformationResponse['InstanceInformationList'].filter(i => i.PingStatus === 'Online')
        if (instances.length > 0) {
          // For every instance that fulfill we obtain...
          instances.forEach(instance => {
            // Add name if exists
            instance['ComputerName'] = instance.InstanceId
            instance['Name'] = instance['ComputerName']
          })

          // We have found and managed a list of instances
          this.loggingService.logger('Obtained smm info from aws for SSM', LoggerLevel.info, this)
          return instances
        } else {
          // No instances usable
          throw new Error('No instances are accessible by this Role.')
        }
      } else {
        // No instances usable
        throw new Error('No instances are accessible by this Role.')
      }
    } catch (err) {
      throw new LeappBaseError('Leapp SSM error', this, LoggerLevel.warn, err.message)
    }
  }

  private async applyEc2MetadataInformation(instances: any): Promise<any> {
    try {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const params = {MaxResults: 50}
      const reservations = await this.ec2Client.describeInstances(params).promise()

      instances.forEach(instance => {
        const foundInstance = reservations.Reservations.filter(r => r.Instances[0].InstanceId === instance.Name)
        if (foundInstance.length > 0) {
          const foundName = foundInstance[0].Instances[0].Tags.filter(t => t.Key === 'Name')
          if (foundName.length > 0) {
            instance.Name = foundName[0].Value
          }
        }
      })

      return instances
    } catch (err) {
      throw new LeappBaseError('Leapp', this, LoggerLevel.warn, err.message)
    }
  }
}
