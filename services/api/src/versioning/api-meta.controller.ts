import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { versionsDocument } from './api-versions.js';

/**
 * The version registry, readable over the wire.
 *
 * A version scheme nobody can query is a version scheme clients guess at. This
 * is what an integrator reads to answer "which version do I call, is the one I
 * am calling deprecated, and by when does it stop answering" — the same three
 * questions the 404 responses answer, for the client that has not made a
 * mistake yet.
 *
 * Public, and served inside the version it describes, so a client pinned to a
 * deprecated version can still discover its successor.
 */
@ApiTags('meta')
@Controller('meta')
export class ApiMetaController {
  @Public()
  @Get('versions')
  @ApiOperation({ summary: 'Which API versions exist, which is current, and when each retires' })
  versions() {
    return versionsDocument();
  }
}