import React, { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowRight, Check, ChevronDown, Code2, Download, FileCode2, FileText, Folder, Github, Layers3, LoaderCircle, LockKeyhole, Plus, Rocket, ShieldCheck, Sparkles, UploadCloud, X, AlertCircle } from 'lucide-react'

const API = '/api'
async function api(path, options={}) {
  const response = await fetch(API + path, { credentials: 'include', ...options })
  const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null
  if (!response.ok) throw new Error(data?.detail || `Request failed (${response.status})`)
  return data
}
const formatSize = n => n < 1024 ? `${n} B` : `${(n/1024).toFixed(1)} KB`
const iconFor = path => path.endsWith('.md') || path.endsWith('.txt') ? FileText : FileCode2

export default function App() {
  const [topic, setTopic] = useState('')
  const [stack, setStack] = useState('React + FastAPI')
  const [projectName, setProjectName] = useState('cyber-threat-hunting')
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState('')
  const [error, setError] = useState('')
  const [project, setProject] = useState(null)
  const [selected, setSelected] = useState('')
  const [gh, setGh] = useState({connected:false})
  const [repos, setRepos] = useState([])
  const [showPublish, setShowPublish] = useState(false)
  const [createRepo, setCreateRepo] = useState(true)
  const [owner, setOwner] = useState('')
  const [repo, setRepo] = useState('cyber-threat-hunting')
  const [description, setDescription] = useState('AI-based cyber threat hunting using behavioral analytics and unsupervised learning')
  const [privateRepo, setPrivateRepo] = useState(true)
  const [branch, setBranch] = useState('main')
  const [confirmed, setConfirmed] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [mobileFiles, setMobileFiles] = useState(false)

  const files = project?.files || []
  const selectedFile = files.find(f => f.path === selected)
  const folders = useMemo(() => [...new Set(files.map(f => f.path.split('/').slice(0,-1).join('/')).filter(Boolean))], [files])

  async function refreshGitHub() {
    try {
      const status = await api('/github/status')
      setGh(status)
      if (status.connected) {
        setOwner(status.login || '')
        const r = await api('/github/repositories')
        setRepos(r.repositories || [])
      }
    } catch (e) { setError(e.message) }
  }
  useEffect(() => {
    refreshGitHub()
    if (new URLSearchParams(location.search).get('github') === 'connected') {
      history.replaceState({}, '', '/')
    }
  }, [])

  async function handleUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError(''); setUploading(true)
    try {
      const form = new FormData(); form.append('file', file)
      const data = await api('/projects/upload', {method:'POST', body:form})
      setTopic(prev => `${prev}${prev ? '\n\n' : ''}Uploaded specification (${data.filename}):\n${data.text}`)
    } catch(e) { setError(e.message) } finally { setUploading(false); event.target.value = '' }
  }

  async function generate() {
    setError(''); setPublished(null)
    if (topic.trim().length < 5) { setError('Enter a project topic or upload a specification first.'); return }
    setBusy(true); setStage('Analyzing your specification')
    try {
      await api('/projects/analyze', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({topic, stack})})
      setStage('Generating source files with AI')
      const data = await api('/projects/generate', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({topic, stack, project_name:projectName})})
      setStage('Loading generated files')
      const full = await api(`/projects/${data.project_id}/files`)
      setProject({...data, files:full.files})
      setSelected(full.files[0]?.path || '')
      setRepo(projectName)
      setStage('')
    } catch(e) { setError(e.message); setStage('') } finally { setBusy(false) }
  }

  async function connectGithub() {
    try { const r = await fetch(API + '/github/login', {credentials:'include', redirect:'manual'}); if (r.status === 503) { const d=await r.json(); throw new Error(d.detail) } location.href = API + '/github/login' }
    catch(e) { setError(e.message) }
  }
  async function publish() {
    setError(''); setPublished(null)
    if (!project) return
    if (!confirmed) { setError('Please confirm that you reviewed the files and destination.'); return }
    setPublishing(true)
    try {
      const result = await api('/github/publish', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
        project_id:project.project_id, owner, repo, description, private:privateRepo, branch, create_repo:createRepo, confirmed
      })})
      setPublished(result); setShowPublish(false)
    } catch(e) { setError(e.message) } finally { setPublishing(false) }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon"><Layers3 size={21}/></div><div><b>AI Project Builder</b><small>BUILD • SHIP • CREATE</small></div></div>
      <div className="workspace-label">WORKSPACE</div>
      <button className="side-link active"><Activity size={17}/> Project Studio <span className="side-dot"/></button>
      <button className="side-link" onClick={()=>setShowPublish(true)}><Github size={17}/> GitHub publishing</button>
      <div className="side-divider"/>
      <div className="side-card"><div className="side-card-icon"><ShieldCheck size={18}/></div><b>Secure by design</b><p>Your AI keys stay on the server. Review every file before publishing.</p></div>
      <div className="sidebar-bottom"><span className="status-pip"/> API workspace <span className="version">v1.0</span></div>
    </aside>

    <main className="main">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <b>Project Studio</b></div><div className="top-actions"><span className="secure-label"><LockKeyhole size={14}/> Secure session</span><div className="avatar">AI</div></div></header>
      <div className="content">
        <section className="hero">
          <div className="hero-copy"><div className="eyebrow"><Sparkles size={14}/> YOUR IDEA, ENGINEERED</div><h1>Turn ideas into <span>working software.</span></h1><p>Describe your project. Generate a complete codebase, download it, or publish it straight to GitHub.</p></div>
          <div className="hero-graphic"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="graphic-core"><Code2 size={31}/></div><div className="float-chip chip-one"><Check size={13}/> Clean code</div><div className="float-chip chip-two"><Rocket size={13}/> Ready to ship</div></div>
        </section>

        {error && <div className="alert error"><AlertCircle size={18}/><span>{error}</span><button onClick={()=>setError('')}><X size={16}/></button></div>}
        {published && <div className="alert success"><Check size={18}/><span>Published successfully. <a href={published.url} target="_blank" rel="noreferrer">{published.url}</a></span><button onClick={()=>setPublished(null)}><X size={16}/></button></div>}

        <div className="section-heading"><div><div className="step-label">01 <span>·</span> PROJECT SPECIFICATION</div><h2>What are we building today?</h2><p>Start with a clear topic. The more detail you provide, the better the result.</p></div><div className="step-badge"><span>1</span> Define <i/> <span>2</span> Generate <i/> <span>3</span> Publish</div></div>

        <section className="builder-grid">
          <div className="panel spec-panel">
            <div className="panel-title"><div className="panel-icon purple"><Sparkles size={18}/></div><div><h3>Project brief</h3><p>Describe the features and expected outcome</p></div><span className="required-tag">REQUIRED</span></div>
            <label className="field-label" htmlFor="topic">Project topic & requirements</label>
            <textarea id="topic" value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Example: Build an AI-based cyber threat hunting platform using behavioral analytics and unsupervised learning. Include log ingestion, anomaly detection, a dashboard, REST APIs, and setup instructions..." rows="7"/>
            <div className="textarea-meta"><span>Be specific about features, inputs, and outputs.</span><span>{topic.length.toLocaleString()} / 20,000</span></div>
            <div className="upload-row"><label className="upload-btn"><UploadCloud size={17}/>{uploading ? 'Extracting…' : 'Upload specification'}<input type="file" accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp" onChange={handleUpload} hidden/></label><span>PDF, DOCX, TXT or image · 10 MB max</span></div>
            <div className="form-row">
              <div className="form-group"><label className="field-label">Project name</label><div className="input-wrap"><Folder size={16}/><input value={projectName} onChange={e=>setProjectName(e.target.value)} maxLength="80" placeholder="my-awesome-project"/></div></div>
              <div className="form-group"><label className="field-label">Preferred stack</label><div className="select-wrap"><select value={stack} onChange={e=>setStack(e.target.value)}><option>React + FastAPI</option><option>Python + Flask</option><option>Python + Django</option><option>Node.js + Express</option><option>React + Node.js</option><option>Python machine learning</option><option>Java + Spring Boot</option><option>HTML, CSS + JavaScript</option></select><ChevronDown size={15}/></div></div>
            </div>
            <button className="primary-btn generate-btn" onClick={generate} disabled={busy}>{busy ? <><LoaderCircle className="spin" size={18}/>{stage || 'Working…'}</> : <><Sparkles size={18}/> Generate project <ArrowRight size={17}/></>}</button>
            <div className="fine-print"><LockKeyhole size={13}/> AI credentials stay on the backend. Generated code should be reviewed before production use.</div>
          </div>

          <div className="panel quick-panel">
            <div className="panel-title"><div className="panel-icon blue"><Layers3 size={18}/></div><div><h3>Build overview</h3><p>What you'll get</p></div></div>
            <div className="overview-list">
              <div className="overview-item"><div className="overview-icon"><Folder size={17}/></div><div><b>Complete codebase</b><p>Organized folders and source files</p></div><Check size={16} className="check"/></div>
              <div className="overview-item"><div className="overview-icon"><FileText size={17}/></div><div><b>Project documentation</b><p>README, dependencies, setup guide</p></div><Check size={16} className="check"/></div>
              <div className="overview-item"><div className="overview-icon"><Download size={17}/></div><div><b>ZIP download</b><p>Portable source bundle</p></div><Check size={16} className="check"/></div>
              <div className="overview-item"><div className="overview-icon"><Github size={17}/></div><div><b>GitHub publishing</b><p>Review, confirm, then commit</p></div><Check size={16} className="check"/></div>
            </div>
            <div className="provider-note"><div className="provider-status"><span className="status-pip"/> AI provider connection</div><p>Generation requires an AI API key configured in the backend environment.</p><span className="tiny-tag">SERVER-SIDE ONLY</span></div>
          </div>
        </section>

        {project && <section className="results-section">
          <div className="section-heading results-head"><div><div className="step-label">02 <span>·</span> GENERATED OUTPUT</div><h2>Your project is ready to review</h2><p>{project.file_count} files generated for <b>{project.name}</b>. Inspect the source before shipping.</p></div><div className="result-actions"><a className="secondary-btn" href={`${API}/projects/${project.project_id}/download`}><Download size={16}/> Download ZIP</a><button className="primary-btn compact" onClick={()=>{setShowPublish(true);setConfirmed(false)}}><Github size={16}/> Publish to GitHub</button></div></div>
          <div className="code-workspace">
            <div className="file-sidebar"><div className="file-sidebar-head"><span>EXPLORER</span><span>{files.length} files</span></div><div className="project-root"><Folder size={15}/><b>{project.name}</b></div><div className="file-list">{files.map(file=>{const Icon=iconFor(file.path);return <button key={file.path} className={`file-row ${selected===file.path?'chosen':''}`} onClick={()=>setSelected(file.path)} title={file.path}><Icon size={15}/><span>{file.path}</span><small>{formatSize(file.size)}</small></button>})}</div></div>
            <div className="code-preview"><div className="code-header"><div className="code-tab"><FileCode2 size={15}/>{selected || 'Select a file'}</div><span className="language-chip">{selected?.split('.').pop()?.toUpperCase() || 'CODE'}</span></div><pre><code>{selectedFile?.content || 'Select a file from the explorer to preview its contents.'}</code></pre><div className="code-footer"><span><span className="status-pip"/> Generated source preview</span><button onClick={()=>navigator.clipboard?.writeText(selectedFile?.content || '')} disabled={!selectedFile}>Copy file</button></div></div>
          </div>
          <div className="review-banner"><ShieldCheck size={19}/><div><b>Review before publishing</b><p>AI-generated code may contain errors. Verify functionality, dependencies, and security before deploying.</p></div></div>
        </section>}

        <footer><span>© 2026 AI Project Builder</span><span><ShieldCheck size={14}/> Built with security in mind</span></footer>
      </div>
    </main>

    {showPublish && <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)setShowPublish(false)}}><div className="publish-modal">
      <div className="modal-head"><div className="panel-icon dark"><Github size={19}/></div><div><h2>Publish to GitHub</h2><p>Review the destination and commit contents.</p></div><button className="close-btn" onClick={()=>setShowPublish(false)}><X size={18}/></button></div>
      {!gh.connected ? <div className="connect-box"><div className="github-big"><Github size={27}/></div><h3>Connect your GitHub account</h3><p>Authorize GitHub to let this app create repositories and commit project files on your behalf.</p><button className="primary-btn full" onClick={connectGithub}><Github size={17}/> Connect GitHub <ArrowRight size={16}/></button><small>You'll be redirected to GitHub to authorize. Your password is never requested here.</small></div> : <>
        <div className="connected-line"><div className="avatar github-avatar">GH</div><div><b>Connected as @{gh.login || owner}</b><small>OAuth authorization active</small></div><button className="text-btn" onClick={async()=>{await api('/github/logout',{method:'POST'});setGh({connected:false});setRepos([])}}>Disconnect</button></div>
        <div className="mode-switch"><button className={createRepo?'selected':''} onClick={()=>setCreateRepo(true)}><Plus size={15}/> New repository</button><button className={!createRepo?'selected':''} onClick={()=>setCreateRepo(false)}><Folder size={15}/> Existing repository</button></div>
        <div className="modal-form">
          <label className="field-label">Repository owner</label><input value={owner} onChange={e=>setOwner(e.target.value)} disabled={createRepo} placeholder="GitHub username"/>
          {createRepo ? <><label className="field-label">Repository name</label><input value={repo} onChange={e=>setRepo(e.target.value)} placeholder="my-project"/><label className="field-label">Description</label><input value={description} onChange={e=>setDescription(e.target.value)} maxLength="350" placeholder="What does this project do?"/><label className="check-option"><input type="checkbox" checked={privateRepo} onChange={e=>setPrivateRepo(e.target.checked)}/> Make repository private</label></> :
          <><label className="field-label">Choose repository</label><div className="select-wrap"><select value={`${owner}/${repo}`} onChange={e=>{const [o,r]=e.target.value.split('/');setOwner(o);setRepo(r)}}><option value="">Select a repository…</option>{repos.map(r=><option key={r.full_name} value={r.full_name}>{r.full_name}{r.private?' · private':''}</option>)}</select><ChevronDown size={15}/></div></>}
          <label className="field-label">Target branch</label><input value={branch} onChange={e=>setBranch(e.target.value)} placeholder="main"/>
        </div>
        <div className="publish-file-summary"><div><b>Files to publish</b><span>{files.length} files · {project?.name || 'No project generated'}</span></div><div className="mini-file-list">{files.slice(0,4).map(f=><span key={f.path}><FileCode2 size={12}/>{f.path}</span>)}{files.length>4&&<span>+ {files.length-4} more files</span>}</div></div>
        <label className="confirm-option"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>I reviewed the generated files and confirm publishing them to <b>{owner || 'owner'}/{repo || 'repository'}</b> on branch <b>{branch}</b>.</span></label>
        <button className="primary-btn full" disabled={publishing || !project || !confirmed || !owner || !repo || !branch} onClick={publish}>{publishing?<><LoaderCircle className="spin" size={17}/> Publishing files…</>:<><Rocket size={17}/> Confirm & publish <ArrowRight size={16}/></>}</button>
        <p className="modal-footnote"><LockKeyhole size={12}/> Credentials are held in an HTTP-only session and never displayed in the UI.</p>
      </>}
    </div></div>}
  </div>
}
