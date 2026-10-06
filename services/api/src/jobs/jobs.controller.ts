import { Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/guards/roles.guard.js';
import { zodPipe } from '../common/pipes/zod-validation.pipe.js';
import { jobNameSchema, type JobNameDto } from './dto/job-name.dto.js';
import { JobScheduler } from './job-scheduler.service.js';

/**
 * What an operator can see about the schedule.
 *
 * The whole point of a scheduler that nobody can inspect is that it is
 * indistinguishable from one that is broken. Both look identical from the
 * outside when the job that would have told you has stopped running. So
 * `health` is computed here and nowhere else, from the durable run history
 * rather than from anything the scheduler believes about itself.
 */
@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(@Inject(JobScheduler) private readonly scheduler: JobScheduler) {}

  @Get()
  @Roles('support')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Scheduled jobs, their last runs, and whether the schedule is keeping up',
    description:
      'Read-only. `health` is derived from the run ledger, so it is the same answer on every ' +
      'replica. A job that has not started within three intervals reads as `overdue` — that is ' +
      'the "it silently stopped" signal.',
  })
  list() {
    return this.scheduler.status();
  }

  /**
   * Run one now.
   *
   * Goes through the same lease as the schedule, so it cannot overlap a run
   * already in flight — on this instance or another — and answers 409 rather
   * than quietly doing nothing. `Idempotency-Key` is honoured by the global
   * interceptor like any other POST, so an operator who presses the button
   * twice gets the first run back rather than the second.
   */
  @Post(':name/run')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Run a scheduled job now, under the same lease the schedule uses' })
  run(@Param('name', zodPipe(jobNameSchema)) name: JobNameDto) {
    return this.scheduler.runNow(name);
  }
}
