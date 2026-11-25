import { fileURLToPath } from 'node:url';
import webConfig from '../next.config.mjs';

export default {
  ...webConfig,
  outputFileTracingRoot: fileURLToPath(new URL('../../../', import.meta.url)),
  outputFileTracingIncludes: {
    '/api/official-daily/mcp': ['../../../packages/baseball-data/reports/canonical-runtime-payload/**/*'],
  },
};
