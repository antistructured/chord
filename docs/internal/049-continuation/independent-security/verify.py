import hashlib, json, pathlib, re, shutil, subprocess, tarfile, tempfile
R = pathlib.Path('/home/d/Workspace/other-projects/chord-v0.3.0')
C = R / 'docs/internal/049-continuation'
E = C / 'independent-security'
sha = lambda b: hashlib.sha256(b).hexdigest()
def inventory():
    return {str(p.relative_to(R)): sha(p.read_bytes()) for base in [R/'packages/core', R/'docs/internal'] for p in base.rglob('*') if p.is_file() and 'node_modules' not in p.parts and E not in p.parents and p != C/'independent-security-review.md'} | {n: sha((R/n).read_bytes()) for n in ['README.md','LICENSE','NOTICE']}
before = inventory()
(E/'before.json').write_text(json.dumps(before, indent=2))
commands = []
def run(label, args, cwd):
    p = subprocess.run(args, cwd=cwd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=180)
    (E/(label+'.log')).write_text(p.stdout)
    commands.append(dict(label=label, command=args, cwd=str(cwd), exit=p.returncode))
    (E/'commands.json').write_text(json.dumps(commands, indent=2))
    print(label, p.returncode, p.stdout[-1400:])
    assert p.returncode == 0, label
    return p.stdout
run('environment', ['bash','-c','node --version; bun --version; npm --version; git rev-parse HEAD; git status --short'], R)
A = C/'artifacts/weipertda-chord-0.4.0-preview.1.tgz'
assert sha(A.read_bytes()) == '538987e90ecbaf7b2393d40d11b5cb95dfdee28c25c0a45e743f15526cd5dc9c'
S = C/'artifacts/chord-0.4.0-preview.1-source.tar.gz'
assert sha(S.read_bytes()) == '66cc9c4a9f05aa849cfd80343edddeef5ba48a4d7078bafad8d28f5fa19c1282'
with tarfile.open(A) as t:
    members = t.getmembers()
    assert len(members) == 47
    assert len({m.name for m in members}) == 47
    for m in members:
        assert m.isfile() and m.name.startswith('package/') and '..' not in pathlib.PurePosixPath(m.name).parts
        assert not (m.mode & 0o6000)
    payload = {}
    for m in members:
        stream = t.extractfile(m)
        assert stream is not None
        payload[m.name.removeprefix('package/')] = stream.read()
assert sum(map(len,payload.values())) == 177046
assert all(b == (R/'packages/core'/n).read_bytes() for n,b in payload.items())
for n in payload:
    assert n in ['package.json','README.md','INTEGRITY.md','CHANGELOG.md','LICENSE','NOTICE','THIRD_PARTY_NOTICES.md','examples/quickstart.mjs','examples/cross-actor-workflow.mjs'] or (n.startswith('src/') and n.endswith('.js') and n != 'src/verify-runtime.js')
manifest = json.loads(payload['package.json'])
assert manifest['name'] == '@weipertda/chord' and manifest['version'] == '0.4.0-preview.1'
assert manifest['dependencies'] == {'@weipertda/sigiljs':'0.18.0'}
assert not set(manifest['scripts']).intersection(['preinstall','install','postinstall','prepare','prepublish','prepublishOnly'])
assert not manifest.get('bin') and not manifest.get('bundledDependencies')
assert sha(payload['LICENSE']) == 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30'
assert payload['LICENSE'] == (R/'LICENSE').read_bytes()
findings = []
for n,b in payload.items():
    for pattern in [r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',r'AKIA[0-9A-Z]{16}',r'npm_[A-Za-z0-9]{36}',r'ghp_[A-Za-z0-9]{36}']:
        if re.search(pattern,b.decode()): findings.append({'path':n,'pattern':pattern})
assert not findings
consumer = pathlib.Path(tempfile.mkdtemp(prefix='chord049-independent-security-',dir='/home/d/.hermes/cache/scratch'))
(consumer/'package.json').write_text(json.dumps({'name':'independent-security-consumer','private':True,'type':'module','version':'1.0.0'}))
shutil.copy2(A,consumer/A.name)
run('install',['npm','install','./'+A.name,'--ignore-scripts','--no-audit','--no-fund'],consumer)
installed = consumer/'node_modules/@weipertda/chord'
assert not installed.is_symlink()
assert all((installed/n).read_bytes() == b for n,b in payload.items())
assert set(str(p.relative_to(installed)) for p in installed.rglob('*') if p.is_file()) == set(payload)
run('dependencies',['npm','ls','--all','--json'],consumer)
dep = consumer/'node_modules/@weipertda/sigiljs'
dm = json.loads((dep/'package.json').read_text())
assert dm['version'] == '0.18.0' and dm['license'] == 'MIT'
assert (dep/'LICENSE').read_text().strip() in payload['THIRD_PARTY_NOTICES.md'].decode()
(E/'dependency-package.json').write_text(json.dumps(dm,indent=2))
(E/'consumer-lock.json').write_bytes((consumer/'package-lock.json').read_bytes())
for n in ['public.test.mjs','journal.test.mjs','exports.mjs']:
    shutil.copy2(C/'consumer-fixtures'/n,consumer/n)
    shutil.copy2(consumer/n,E/n)
readme_match = re.search(r'```js\n(.*?)```',payload['README.md'].decode(),re.S)
assert readme_match is not None
readme = readme_match.group(1)
assert readme == payload['examples/quickstart.mjs'].decode()
(consumer/'readme-example.mjs').write_text(readme)
for runtime in ['node','bun']:
    run('tests-'+runtime,[runtime,'--test','public.test.mjs','journal.test.mjs'] if runtime == 'node' else [runtime,'test','public.test.mjs','journal.test.mjs'],consumer)
    run('exports-'+runtime,[runtime,'exports.mjs'],consumer)
    for example in ['quickstart','cross-actor-workflow']:
        run(example+'-'+runtime,[runtime,str(installed/'examples'/(example+'.mjs'))],consumer)
    run('readme-'+runtime,[runtime,'readme-example.mjs'],consumer)
run('repack',['npm','pack','--ignore-scripts','--json','--pack-destination',str(consumer)],installed)
assert sha((consumer/A.name).read_bytes()) == sha(A.read_bytes())
after = inventory()
changes = sorted(k for k in before.keys() | after.keys() if before.get(k) != after.get(k))
assert not changes, changes
result = dict(verdict='PASS',artifact=str(A.relative_to(R)),sha256=sha(A.read_bytes()),source_sha256=sha(S.read_bytes()),entries=len(payload),packed_bytes=A.stat().st_size,unpacked_bytes=sum(map(len,payload.values())),consumer=str(consumer),payload=[dict(path=n,sha256=sha(b),bytes=len(b)) for n,b in sorted(payload.items())],credential_pattern_findings=findings,protected_file_changes=changes,installed_payload_exact=True,repack_byte_identical=True)
(E/'result.json').write_text(json.dumps(result,indent=2))
print(json.dumps({k:v for k,v in result.items() if k != 'payload'},indent=2))
