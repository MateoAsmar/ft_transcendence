/**
 * Shared Scoreboard Component
 * Used across all game modes (AI, Local, Remote, Tournament)
 * Displays player names, scores, and optional game timer
 */

export interface ScoreboardOptions {
  /**
   * Optional timer display (e.g., "2:45" or "Countdown: 3")
   */
  showTimer?: boolean;
  
  /**
   * Optional additional CSS classes for customization
   */
  customClasses?: string;
  
  /**
   * Optional mode-specific badge (e.g., "TOURNAMENT MATCH")
   */
  badge?: {
    text: string;
    color: string; // e.g., "purple", "cyan", "green"
  };
}

/**
 * Generate scoreboard markup for display above the game canvas
 */
export function getScoreboardMarkup(options: ScoreboardOptions = {}): string {
  const { showTimer = false, customClasses = '', badge } = options;
  
  return `
    <div class="w-full max-w-5xl mx-auto mb-6 ${customClasses}">
      ${badge ? `
        <!-- Mode Badge (Tournament, Ranked, etc.) -->
        <div class="flex justify-center mb-3">
          <div class="bg-${badge.color}-900/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-${badge.color}-500/50 shadow-lg">
            <p class="text-xs text-${badge.color}-300 font-semibold tracking-wide">${badge.text}</p>
          </div>
        </div>
      ` : ''}
      
      <!-- Scoreboard -->
      <div class="bg-gray-900/90 backdrop-blur-sm rounded-xl border border-gray-700 shadow-2xl overflow-hidden">
        <div class="flex items-center justify-between px-8 py-4">
          <!-- Player 1 -->
          <div class="flex-1 text-left">
            <div class="text-sm text-gray-400 mb-1">Player 1</div>
            <div class="flex items-center gap-3">
              <div class="text-3xl font-bold text-cyan-400" id="score1">0</div>
              <div class="text-lg text-cyan-300 font-semibold" id="player1Name">Player 1</div>
            </div>
          </div>
          
          <!-- Player 2 -->
          <div class="flex-1 text-right">
            <div class="text-sm text-gray-400 mb-1">Player 2</div>
            <div class="flex items-center justify-end gap-3">
              <div class="text-lg text-pink-300 font-semibold" id="player2Name">Player 2</div>
              <div class="text-3xl font-bold text-pink-400" id="score2">0</div>
            </div>
          </div>
        </div>
        
        <!-- Progress Bar (Optional) -->
        <div class="h-1 bg-gray-800 relative overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 opacity-30"></div>
          <div id="scoreProgress" class="h-full bg-gradient-to-r from-cyan-400 to-pink-400 transition-all duration-300" style="width: 50%"></div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Scoreboard Controller - Handles updates to the scoreboard DOM
 */
export class ScoreboardController {
  private score1Element: HTMLElement | null;
  private score2Element: HTMLElement | null;
  private player1NameElement: HTMLElement | null;
  private player2NameElement: HTMLElement | null;
  private timerElement: HTMLElement | null;
  private progressElement: HTMLElement | null;
  
  constructor() {
    this.score1Element = document.getElementById('score1');
    this.score2Element = document.getElementById('score2');
    this.player1NameElement = document.getElementById('player1Name');
    this.player2NameElement = document.getElementById('player2Name');
    this.timerElement = document.getElementById('gameTimer');
    this.progressElement = document.getElementById('scoreProgress');
  }
  
  /**
   * Update player scores
   */
  public updateScores(score1: number, score2: number, maxScore: number = 3): void {
    if (this.score1Element) this.score1Element.textContent = score1.toString();
    if (this.score2Element) this.score2Element.textContent = score2.toString();
    
    // Update progress bar
    if (this.progressElement) {
      const totalScore = score1 + score2;
      const maxTotalScore = maxScore * 2;
      const progress = Math.min(100, (totalScore / maxTotalScore) * 100);
      this.progressElement.style.width = `${progress}%`;
    }
  }
  
  /**
   * Update player names
   */
  public updatePlayerNames(player1Name: string, player2Name: string): void {
    if (this.player1NameElement) this.player1NameElement.textContent = player1Name;
    if (this.player2NameElement) this.player2NameElement.textContent = player2Name;
  }
  
  /**
   * Update game timer
   */
  public updateTimer(seconds: number): void {
    if (!this.timerElement) return;
    
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    this.timerElement.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
  
  /**
   * Reset scoreboard to initial state
   */
  public reset(): void {
    this.updateScores(0, 0);
    this.updatePlayerNames('Player 1', 'Player 2');
    if (this.timerElement) this.timerElement.textContent = '0:00';
  }
  
  /**
   * Highlight winner
   */
  public highlightWinner(winner: 1 | 2): void {
    const winnerScore = winner === 1 ? this.score1Element : this.score2Element;
    const winnerName = winner === 1 ? this.player1NameElement : this.player2NameElement;
    
    if (winnerScore) {
      winnerScore.classList.add('animate-pulse');
      winnerScore.style.transform = 'scale(1.2)';
    }
    
    if (winnerName) {
      winnerName.classList.add('animate-pulse');
    }
  }
}
