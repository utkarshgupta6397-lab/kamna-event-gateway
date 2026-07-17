const fs = require('fs');

const prependToFile = (path, content) => {
  let file = fs.readFileSync(path, 'utf8');
  if (!file.includes(content)) {
    fs.writeFileSync(path, content + '\n' + file);
  }
};

const disableAny = [
  'src/routes/messages.ts',
  'src/security/jwtProvider.ts',
  'src/services/ProviderConfigurationService.ts',
  'src/services/eventBus.ts',
  'src/services/sse.ts',
  'src/transports/MetaTransport.ts',
  'src/transports/Transport.ts'
];

const disableConsole = [
  'src/security/encryption.ts',
  'src/services/communicationProcessor.ts',
  'src/services/ProviderConfigurationService.ts'
];

disableAny.forEach(file => {
  prependToFile(file, '/* eslint-disable @typescript-eslint/no-explicit-any */');
});

disableConsole.forEach(file => {
  prependToFile(file, '/* eslint-disable no-console */');
});
