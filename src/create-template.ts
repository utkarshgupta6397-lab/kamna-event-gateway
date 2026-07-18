/* eslint-disable no-console */
import { ProviderConfigurationService } from './services/ProviderConfigurationService';

async function createTemplate() {
  const config = await ProviderConfigurationService.getMetaConfiguration();
  const url = `https://graph.facebook.com/${config!.apiVersion}/${config!.businessAccountId}/message_templates`;

  const payload = {
    name: "media_test_dashboard",
    language: "en_US",
    category: "UTILITY",
    components: [
      {
        type: "HEADER",
        format: "IMAGE"
      },
      {
        type: "BODY",
        text: "This is a media test template."
      }
    ]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config!.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const json = await response.json();
  console.log(JSON.stringify(json, null, 2));
}

createTemplate().catch(console.error);
