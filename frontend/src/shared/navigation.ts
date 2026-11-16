export function navigateSpa(path: string, replace = false): void {
  const spaNavigate = (window as any)?.navigate;
  if (typeof spaNavigate === 'function') {
    spaNavigate(path, replace);
    return;
  }

  if (replace) {
    window.location.replace(path);
  } else {
    window.location.href = path;
  }
}
