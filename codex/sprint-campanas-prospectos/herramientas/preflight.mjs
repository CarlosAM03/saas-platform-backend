#!/usr/bin/env node
// SAFE: No git writes, no network calls, no source edits. Optional --guardar writes a sanitized JSON in the harness evidence directory.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
const harnessRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(harnessRoot, '..', '..');
const args = process.argv.slice(2);
const save = args.includes('--guardar');
function git(...params) {
  try {return execFileSync('git', params, {cwd:repoRoot, encoding:'utf8', timeout:10000, maxBuffer:2*1024*1024, stdio:['ignore','pipe','pipe']}).trim();}
  catch(err) {return `ERROR (${params.join(' ')}): ${err?.status??'unknown'}`;}
}
function scrubRemote(s) {
  if (!s || s.startsWith('ERROR')) return 'NO_DISPONIBLE';
  // Strip possible credentials, local remote paths and query parameters.
  const m=s.match(/(?:github\.com[:/])([^\s?#]+?)(?:\.git)?$/i);
  return m ? `github.com/${m[1].replace(/\.git$/i,'')}` : 'REMOTO_NO_RECONOCIDO';
}
const remote=scrubRemote(git('remote','get-url','origin'));
const branch=git('branch','--show-current');
const head=git('rev-parse','HEAD');
const top=git('rev-parse','--show-toplevel');
const status=git('status','--porcelain=v1','--untracked-files=all').split('\n').filter(Boolean);
const outsideHarness=status.filter(x=>!x.slice(3).replaceAll('\\','/').startsWith('codex/sprint-campanas-prospectos/'));
const required=['package.json','Prisma/schema.prisma','src/campaigns','src/prospects','Docs/ADRs/ADR-004-CommonBaseline.md'];
const missing=required.filter(x=>!existsSync(join(repoRoot,x)));
const authPath=join(harnessRoot,'05_EVIDENCIAS/G0/AUTORIZACION_BASE_OWNER.md');
const authText=existsSync(authPath)?readFileSync(authPath,'utf8'):'';
const authLooksPending=/\*\*ESTADO:\s*PENDIENTE/i.test(authText);
const report={
  scope:'LOCAL_READ_ONLY_PREFLIGHT',
  timestamp:new Date().toISOString(),
  location:'repo root relative to harness',
  remoteSanitized:remote,
  expectedRemote:'github.com/CarlosAM03/saas-platform-backend',
  remoteMatchesExpected:remote.toLowerCase()==='github.com/carlosam03/saas-platform-backend',
  branch,head,
  topLevelIsExpected:(resolve(top)===repoRoot),
  changesCountIncludingHarness:status.length,
  changesOutsideHarness:outsideHarness.length,
  cleanOutsideHarness:outsideHarness.length===0,
  missingRequiredPaths:missing,
  ownerAuthorizationDocumentExists:existsSync(authPath),
  ownerAuthorizationStillTemplate:authLooksPending,
  gate0:'REQUIERE_VERIFICACION_Y_GO_EXPLICITO_DEL_OWNER',
  notes:['This tool never grants G0.','Historical feat/tenant-register refs are not permission to start.','No credential values or modified file names are exported.']
};
console.log(JSON.stringify(report,null,2));
if(save){
 const out=join(harnessRoot,'05_EVIDENCIAS/G0/preflight-local.json');
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.error('Evidence written: '+out);
}
if(!report.topLevelIsExpected||!report.remoteMatchesExpected||missing.length){process.exitCode=2;}
