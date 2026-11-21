export default function OfficeHeader({signedIn, current = 'office'}: {signedIn: boolean; current?: 'office' | 'directory'}) {
  return <header className="home-header">
    <a className="brand" href="/" aria-label="Daftar home"><span className="brand-mark" aria-hidden="true">D</span><span>DAFTAR <small>YOUR WORK, TOGETHER</small></span></a>
    <nav aria-label="Daftar workspace">
      <a href="/" aria-current={current === 'office' ? 'page' : undefined}>One Office</a>
      <a href="/applications" aria-current={current === 'directory' ? 'page' : undefined}>Directory</a>
      <a href="/workspace/chrome.html#office">Donna & teams</a>
      <a href="/#devices">Devices</a>
      <a href="https://github.com/occult-kranti/engineering-intelligence-atlas/releases" target="_blank" rel="noreferrer">Downloads</a>
      {signedIn ? <a href="/signout-with-chatgpt?return_to=%2F" target="_top">Sign out</a> : <a href={'/signin-with-chatgpt?return_to=' + encodeURIComponent(current === 'directory' ? '/applications' : '/')} target="_top">Sign in</a>}
    </nav>
  </header>;
}
