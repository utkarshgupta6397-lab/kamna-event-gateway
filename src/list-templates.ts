/* eslint-disable no-console */
import { MetaApiService } from './services/metaApiService';

async function listTemplates() {
  const templates = await MetaApiService.getTemplates();
  console.log(JSON.stringify(templates, null, 2));
}

listTemplates().catch(console.error);
