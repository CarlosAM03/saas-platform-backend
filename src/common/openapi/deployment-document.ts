import type { OpenAPIObject } from '@nestjs/swagger';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

/** Served specification of the implemented API; admission is checked on every POST. */
export function deploymentDocument(): OpenAPIObject {
  const document = load(
    readFileSync('./Docs/Contracts/platform-api.v1.yaml', 'utf8'),
  ) as OpenAPIObject;
  document.servers = [{ url: '/' }];
  const list = document.paths['/api/v1/prospecting-jobs'].get!;
  list.parameters = list.parameters?.map((parameter) =>
    '$ref' in parameter && parameter.$ref === '#/components/parameters/SortBy'
      ? {
          name: 'sortBy',
          in: 'query',
          schema: {
            type: 'string',
            default: 'createdAt',
            enum: [
              'createdAt',
              'updatedAt',
              'startedAt',
              'completedAt',
              'status',
              'id',
            ],
          },
        }
      : parameter,
  );
  return document;
}
