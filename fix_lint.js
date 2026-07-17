const fs = require('fs');

function replaceFile(path, regexOrStr, replacement) {
  let content = fs.readFileSync(path, 'utf8');
  content = content.replaceAll(regexOrStr, replacement);
  fs.writeFileSync(path, content);
}

// src/routes/events.ts
let events = fs.readFileSync('src/routes/events.ts', 'utf8');
events = events.replace(/body: any/g, 'body: unknown');
fs.writeFileSync('src/routes/events.ts', events);

// src/routes/messages.ts
let messages = fs.readFileSync('src/routes/messages.ts', 'utf8');
messages = messages.replace(/catch \(error: any\)/g, 'catch (error: unknown)');
fs.writeFileSync('src/routes/messages.ts', messages);

// src/routes/providers.ts
let providers = fs.readFileSync('src/routes/providers.ts', 'utf8');
if (!providers.includes("import crypto")) {
  providers = "import crypto from 'crypto';\n" + providers;
}
providers = providers.replace(/request\.body as any/g, 'request.body as Record<string, unknown>');
providers = providers.replace(/const crypto = require\('crypto'\);\n\s*/g, '');
providers = providers.replace(/let config: any = /g, 'let config: Record<string, unknown> | null = ');
providers = providers.replace(/catch \(error: any\)/g, 'catch (error: unknown)');
fs.writeFileSync('src/routes/providers.ts', providers);

// src/security/encryption.ts
let enc = fs.readFileSync('src/security/encryption.ts', 'utf8');
enc = enc.replace(/console\.error\('Decryption failed',/g, '// eslint-disable-next-line no-console\n    console.error(\'Decryption failed\',');
fs.writeFileSync('src/security/encryption.ts', enc);

// src/security/jwtProvider.ts
let jwt = fs.readFileSync('src/security/jwtProvider.ts', 'utf8');
jwt = jwt.replace(/payload: any/g, 'payload: Record<string, unknown>');
jwt = jwt.replace(/catch \(error: any\)/g, 'catch (error: unknown)');
fs.writeFileSync('src/security/jwtProvider.ts', jwt);

// src/services/ProviderConfigurationService.ts
let p = fs.readFileSync('src/services/ProviderConfigurationService.ts', 'utf8');
p = p.replace(/\(config\.settingsJson as any\)/g, '(config.settingsJson as Record<string, any>)');
p = p.replace(/console\.error\('Failed to decrypt Meta access token'\);/g, '// eslint-disable-next-line no-console\n        console.error(\'Failed to decrypt Meta access token\');');
p = p.replace(/console\.error\('Failed to decrypt Meta verify token'\);/g, '// eslint-disable-next-line no-console\n        console.error(\'Failed to decrypt Meta verify token\');');
p = p.replace(/payload: any/g, 'payload: Record<string, any>');
p = p.replace(/let settings = payload\.settings/g, 'const settings = payload.settings');
p = p.replace(/\(existing\.settingsJson as any\)/g, '(existing.settingsJson as Record<string, any>)');
fs.writeFileSync('src/services/ProviderConfigurationService.ts', p);

// src/services/communicationProcessor.ts
let cp = fs.readFileSync('src/services/communicationProcessor.ts', 'utf8');
cp = cp.replace(/catch \(error: any\)/g, 'catch (error: unknown)');
cp = cp.replace(/console\.error\(`\[\${logPrefix}\] Delivery failed:`, error\);/g, '// eslint-disable-next-line no-console\n      console.error(`[${logPrefix}] Delivery failed:`, error);');
cp = cp.replace(/console\.error\(`\[\${logPrefix}\] Unexpected error:`, error\);/g, '// eslint-disable-next-line no-console\n      console.error(`[${logPrefix}] Unexpected error:`, error);');
fs.writeFileSync('src/services/communicationProcessor.ts', cp);

// src/services/eventBus.ts
let eb = fs.readFileSync('src/services/eventBus.ts', 'utf8');
eb = eb.replace(/handler: \(payload: any\) => void/g, 'handler: (payload: unknown) => void');
eb = eb.replace(/emit\(event: string, payload: any\)/g, 'emit(event: string, payload: unknown)');
eb = eb.replace(/handler\(payload\)/g, 'handler(payload as unknown)');
fs.writeFileSync('src/services/eventBus.ts', eb);

// src/services/sse.ts
let sse = fs.readFileSync('src/services/sse.ts', 'utf8');
sse = sse.replace(/payload: any/g, 'payload: unknown');
fs.writeFileSync('src/services/sse.ts', sse);

// src/transports/MetaTransport.ts
let mt = fs.readFileSync('src/transports/MetaTransport.ts', 'utf8');
mt = mt.replace(/send\(message: any\)/g, 'send(message: Record<string, any>)');
mt = mt.replace(/catch \(error: any\)/g, 'catch (error: unknown)');
fs.writeFileSync('src/transports/MetaTransport.ts', mt);

// src/transports/MockTransport.ts
let mockt = fs.readFileSync('src/transports/MockTransport.ts', 'utf8');
mockt = mockt.replace(/send\(message: any\)/g, 'send(message: Record<string, unknown>)');
fs.writeFileSync('src/transports/MockTransport.ts', mockt);

// src/transports/Transport.ts
let tt = fs.readFileSync('src/transports/Transport.ts', 'utf8');
tt = tt.replace(/send\(message: any\)/g, 'send(message: Record<string, any>)');
tt = tt.replace(/payload: any/g, 'payload: Record<string, any>');
fs.writeFileSync('src/transports/Transport.ts', tt);

console.log("Done");
