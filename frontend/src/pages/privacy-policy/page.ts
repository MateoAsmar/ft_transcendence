import { renderBackground, renderNavbar } from '../../shared/ui/layout';

export async function render(container: HTMLElement) {
  container.innerHTML = `
    ${renderBackground()}
    ${renderNavbar({ title: 'Privacy Policy' })}
    <div class="min-h-screen py-8 px-4">
      <div class="max-w-4xl mx-auto bg-gray-900/80 backdrop-blur border border-gray-700 rounded-xl shadow-[0_0_30px_rgba(34,211,238,0.2)] p-8">
        <h1 class="text-4xl font-bold text-white mb-2">Privacy Policy</h1>
        <p class="text-sm text-gray-400 mb-8">Last updated: November 5, 2025</p>

        <section class="mb-8">
          <h2 class="text-2xl font-bold text-cyan-400 mb-4 pb-2 border-b border-gray-700">Introduction</h2>
          <p class="text-gray-300 leading-relaxed">
            Welcome to Transcendence. This Privacy Policy explains how we collect, use, and protect your personal data
            in accordance with the General Data Protection Regulation (GDPR) and other applicable data protection laws.
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-2xl font-bold text-cyan-400 mb-4 pb-2 border-b border-gray-700">Data We Collect</h2>
          <p class="text-gray-300 leading-relaxed mb-3">We collect and process the following personal information:</p>
          <ul class="list-disc list-inside space-y-2 text-gray-300 ml-4">
            <li><strong class="text-white">Account Information:</strong> Email address, username, display name</li>
            <li><strong class="text-white">Profile Data:</strong> Avatar images, authentication provider information</li>
            <li><strong class="text-white">Game Data:</strong> Match history, game statistics (wins, losses), tournament participation</li>
            <li><strong class="text-white">Social Data:</strong> Friend connections, friend requests, game invitations</li>
            <li><strong class="text-white">OAuth Data:</strong> If you sign in with Google or 42, we receive your OAuth ID and basic profile information</li>
            <li><strong class="text-white">Security Data:</strong> Two-factor authentication settings (if enabled)</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-2xl font-bold text-cyan-400 mb-4 pb-2 border-b border-gray-700">Why We Collect This Data</h2>
          <p class="text-gray-300 leading-relaxed mb-3">We process your personal data for the following purposes:</p>
          <ul class="list-disc list-inside space-y-2 text-gray-300 ml-4">
            <li><strong class="text-white">Account Management:</strong> To create and maintain your account, authenticate your identity</li>
            <li><strong class="text-white">Game Functionality:</strong> To enable gameplay, matchmaking, and tournament features</li>
            <li><strong class="text-white">Social Features:</strong> To connect you with friends and enable multiplayer interactions</li>
            <li><strong class="text-white">Statistics & Leaderboards:</strong> To track performance and display rankings</li>
            <li><strong class="text-white">Security:</strong> To protect your account and prevent unauthorized access</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-2xl font-bold text-cyan-400 mb-4 pb-2 border-b border-gray-700">Legal Basis for Processing</h2>
          <p class="text-gray-300 leading-relaxed mb-3">We process your data based on:</p>
          <ul class="list-disc list-inside space-y-2 text-gray-300 ml-4">
            <li><strong class="text-white">Contractual Necessity:</strong> Processing is necessary to provide our services to you</li>
            <li><strong class="text-white">Legitimate Interests:</strong> To improve our services and ensure platform security</li>
            <li><strong class="text-white">Consent:</strong> Where you have explicitly agreed to data processing (e.g., OAuth providers)</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-2xl font-bold text-cyan-400 mb-4 pb-2 border-b border-gray-700">Your Rights Under GDPR</h2>
          <p class="text-gray-300 leading-relaxed mb-6">You have the following rights regarding your personal data:</p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-gray-800/60 border border-gray-700 rounded-lg p-5 hover:shadow-lg hover:shadow-cyan-500/20 transition-all">
              <h3 class="text-lg font-semibold text-cyan-400 mb-2">Right to Access</h3>
              <p class="text-sm text-gray-300">You can export all your personal data at any time using the "Export Data" button in Settings.</p>
            </div>

            <div class="bg-gray-800/60 border border-gray-700 rounded-lg p-5 hover:shadow-lg hover:shadow-cyan-500/20 transition-all">
              <h3 class="text-lg font-semibold text-cyan-400 mb-2">Right to Rectification</h3>
              <p class="text-sm text-gray-300">You can edit your profile information (username, display name, avatar) at any time through your profile settings.</p>
            </div>

            <div class="bg-gray-800/60 border border-gray-700 rounded-lg p-5 hover:shadow-lg hover:shadow-cyan-500/20 transition-all">
              <h3 class="text-lg font-semibold text-cyan-400 mb-2">Right to Erasure</h3>
              <p class="text-sm text-gray-300">You can permanently delete your account and all associated data using the "Delete Account" button in Settings.</p>
            </div>

            <div class="bg-gray-800/60 border border-gray-700 rounded-lg p-5 hover:shadow-lg hover:shadow-cyan-500/20 transition-all">
              <h3 class="text-lg font-semibold text-cyan-400 mb-2">Right to Anonymization</h3>
              <p class="text-sm text-gray-300">You can request anonymization of your personal data while preserving game statistics using the "Anonymize Account" button.</p>
            </div>

            <div class="bg-gray-800/60 border border-gray-700 rounded-lg p-5 hover:shadow-lg hover:shadow-cyan-500/20 transition-all">
              <h3 class="text-lg font-semibold text-cyan-400 mb-2">Right to Data Portability</h3>
              <p class="text-sm text-gray-300">Your exported data is provided in JSON format, allowing you to transfer it to another service.</p>
            </div>

            <div class="bg-gray-800/60 border border-gray-700 rounded-lg p-5 hover:shadow-lg hover:shadow-cyan-500/20 transition-all">
              <h3 class="text-lg font-semibold text-cyan-400 mb-2">Right to Object</h3>
              <p class="text-sm text-gray-300">You can object to certain data processing by adjusting your privacy settings or contacting us.</p>
            </div>
          </div>
        </section>

        <section class="mb-8">
          <h2 class="text-2xl font-bold text-cyan-400 mb-4 pb-2 border-b border-gray-700">How to Exercise Your Rights</h2>
          <p class="text-gray-300 leading-relaxed mb-3">You can exercise your data rights by:</p>
          <ol class="list-decimal list-inside space-y-2 text-gray-300 ml-4">
            <li>Go to <strong class="text-white">Settings → Data Management</strong></li>
            <li>Use the available options:
              <ul class="list-disc list-inside ml-6 mt-2 space-y-1">
                <li><strong class="text-white">Export Your Data</strong> - Download all your personal data</li>
                <li><strong class="text-white">Anonymize Account</strong> - Remove personal information while keeping statistics</li>
                <li><strong class="text-white">Delete Account</strong> - Permanently remove your account and all data</li>
              </ul>
            </li>
          </ol>
        </section>

        <section class="mb-8">
          <h2 class="text-2xl font-bold text-cyan-400 mb-4 pb-2 border-b border-gray-700">Data Retention</h2>
          <p class="text-gray-300 leading-relaxed mb-3">We retain your personal data for as long as your account is active. When you:</p>
          <ul class="list-disc list-inside space-y-2 text-gray-300 ml-4">
            <li><strong class="text-white">Delete your account:</strong> All personal data is permanently removed from our systems</li>
            <li><strong class="text-white">Anonymize your account:</strong> Personal identifiers are removed, but anonymized game statistics are retained for platform integrity</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-2xl font-bold text-cyan-400 mb-4 pb-2 border-b border-gray-700">Data Security</h2>
          <p class="text-gray-300 leading-relaxed mb-3">We implement appropriate technical and organizational measures to protect your data:</p>
          <ul class="list-disc list-inside space-y-2 text-gray-300 ml-4">
            <li>Passwords are hashed using industry-standard algorithms</li>
            <li>HTTPS encryption for all data transmission</li>
            <li>Secure authentication protocols</li>
            <li>Regular security updates and monitoring</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-2xl font-bold text-cyan-400 mb-4 pb-2 border-b border-gray-700">Third-Party Services</h2>
          <p class="text-gray-300 leading-relaxed mb-3">We may share limited data with third-party services:</p>
          <ul class="list-disc list-inside space-y-2 text-gray-300 ml-4">
            <li><strong class="text-white">OAuth Providers (Google, 42):</strong> If you choose to sign in with these services, we receive basic profile information according to their privacy policies</li>
          </ul>
          <p class="text-gray-300 leading-relaxed mt-3">We do not sell or share your personal data with third parties for marketing purposes.</p>
        </section>

        <section class="mb-8">
          <h2 class="text-2xl font-bold text-cyan-400 mb-4 pb-2 border-b border-gray-700">Cookies and Tracking</h2>
          <p class="text-gray-300 leading-relaxed mb-3">We use essential cookies to:</p>
          <ul class="list-disc list-inside space-y-2 text-gray-300 ml-4">
            <li>Maintain your login session</li>
            <li>Remember your preferences</li>
            <li>Ensure platform functionality</li>
          </ul>
          <p class="text-gray-300 leading-relaxed mt-3">We do not use tracking cookies or analytics that collect personal data without your consent.</p>
        </section>

        <section class="mb-8">
          <h2 class="text-2xl font-bold text-cyan-400 mb-4 pb-2 border-b border-gray-700">International Data Transfers</h2>
          <p class="text-gray-300 leading-relaxed">Your data is stored and processed in secure facilities. If data is transferred internationally, we ensure appropriate safeguards are in place to protect your rights.</p>
        </section>

        <section class="mb-8">
          <h2 class="text-2xl font-bold text-cyan-400 mb-4 pb-2 border-b border-gray-700">Children's Privacy</h2>
          <p class="text-gray-300 leading-relaxed">Our service is not intended for children under 13 years of age. We do not knowingly collect personal data from children.</p>
        </section>

        <section class="mb-8">
          <h2 class="text-2xl font-bold text-cyan-400 mb-4 pb-2 border-b border-gray-700">Changes to This Policy</h2>
          <p class="text-gray-300 leading-relaxed">We may update this Privacy Policy from time to time. We will notify you of any significant changes by updating the "Last updated" date at the top of this page.</p>
        </section>

        <section class="mb-8">
          <h2 class="text-2xl font-bold text-cyan-400 mb-4 pb-2 border-b border-gray-700">Contact Us</h2>
          <p class="text-gray-300 leading-relaxed mb-3">If you have questions about this Privacy Policy or wish to exercise your data rights, you can:</p>
          <ul class="list-disc list-inside space-y-2 text-gray-300 ml-4">
            <li>Use the Data Management tools in Settings</li>
            <li>Contact us through the platform's support channels</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-2xl font-bold text-cyan-400 mb-4 pb-2 border-b border-gray-700">Supervisory Authority</h2>
          <p class="text-gray-300 leading-relaxed">If you believe your data protection rights have been violated, you have the right to lodge a complaint with your local data protection supervisory authority.</p>
        </section>

        <div class="mt-8 pt-6 border-t border-gray-700">
          <a href="/settings" data-link class="text-cyan-400 hover:text-cyan-300 transition-colors font-medium">← Back to Settings</a>
        </div>
      </div>
    </div>
  `;
}
