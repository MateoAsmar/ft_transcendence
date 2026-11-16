export interface NavbarOptions {
  title: string;
  subtitle?: string;
  rightContent?: string;
  className?: string;
}

export function renderNavbar({ title, subtitle = '', rightContent, className = '' }: NavbarOptions): string {
  return `
    <header class="min-h-[104px] px-6 sm:px-8 py-6 border-b border-gray-800 flex flex-col gap-4 md:flex-row md:items-center md:justify-between ${className}">
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold text-cyan-300 tracking-wide">${title}</h1>
        ${subtitle ? `<p class="text-sm text-gray-400 max-w-3xl">${subtitle}</p>` : ''}
      </div>
      <div class="flex items-center justify-end gap-3 min-h-[2.75rem]">
        ${rightContent ?? ''}
      </div>
    </header>
  `;
}

export interface BackButtonOptions {
  href: string;
  label?: string;
  className?: string;
}

export function renderBackButton({ href, label = 'Back', className = '' }: BackButtonOptions): string {
  return `
    <a data-link href="${href}" class="inline-flex items-center gap-2 px-4 py-2 border border-gray-600 rounded-lg text-gray-300 hover:text-cyan-300 hover:border-cyan-300 transition-colors ${className}">
      <span aria-hidden="true">&larr;</span>
      <span>${label}</span>
    </a>
  `;
}

export interface BackgroundOptions {
  className?: string;
}

export function renderBackground({ className = '' }: BackgroundOptions = {}): string {
  return `
    <div class="absolute inset-0 pointer-events-none ${className}">
      <div class="absolute inset-0 grid-pattern opacity-60"></div>
      <div class="absolute inset-0 bg-gradient-to-br from-blue-900/25 via-purple-900/15 to-pink-900/20"></div>
      <div class="absolute inset-0" style="background: radial-gradient(circle at 20% 80%, rgba(34, 211, 238, 0.12) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(236, 72, 153, 0.12) 0%, transparent 50%);"></div>
    </div>
  `;
}

export interface SidebarShellOptions {
  content: string;
  className?: string;
}

export function renderSidebarShell({ content, className = '' }: SidebarShellOptions): string {
  return `
    <aside class="w-full max-w-sm bg-gray-900/85 backdrop-blur-sm border-r border-gray-800 overflow-y-auto ${className}">
      ${content}
    </aside>
  `;
}

export interface PageLayoutOptions extends NavbarOptions {
  main: string;
  containerClass?: string;
  mainClass?: string;
}

export function renderPageLayout({
  title,
  subtitle,
  rightContent,
  className,
  main,
  containerClass = '',
  mainClass = '',
}: PageLayoutOptions): string {
  return `
    <div class="min-h-screen bg-black relative overflow-hidden">
      ${renderBackground()}

      <div class="relative z-10 min-h-screen flex flex-col ${containerClass}">
        ${renderNavbar({ title, subtitle, rightContent, className })}

        <main class="flex-1 ${mainClass}">
          ${main}
        </main>
      </div>
    </div>
  `;
}
