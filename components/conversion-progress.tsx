'use client';

/**
 * Progress bar component for streaming Webflow conversion
 *
 * Shows:
 * - Current phase and progress percentage
 * - Current item being processed
 * - Elapsed and estimated remaining time
 * - Cancel button
 */

import { cn } from '@/lib/utils';
import type { ConversionProgress, SectionResult } from '@/lib/webflow-converter-streaming';

// ============================================
// TYPES
// ============================================

interface ConversionProgressBarProps {
  /** Current progress state */
  progress: ConversionProgress | null;
  /** Callback when cancel button is clicked */
  onCancel?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Show detailed timing info */
  showTiming?: boolean;
  /** Show current item being processed */
  showCurrentItem?: boolean;
}

interface SectionListProps {
  /** Completed sections */
  sections: SectionResult[];
  /** Additional CSS classes */
  className?: string;
  /** Maximum sections to show before collapsing */
  maxVisible?: number;
}

interface ConversionStatusProps {
  /** Whether conversion is in progress */
  isConverting: boolean;
  /** Whether conversion was cancelled */
  isCancelled: boolean;
  /** Whether conversion completed */
  isComplete: boolean;
  /** Number of errors */
  errorCount: number;
  /** Number of warnings */
  warningCount: number;
  /** Total processing time in ms */
  totalTimeMs: number | null;
  /** Additional CSS classes */
  className?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format milliseconds as human-readable time
 */
function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Get human-readable phase label
 */
function getPhaseLabel(phase: ConversionProgress['phase']): string {
  const labels: Record<ConversionProgress['phase'], string> = {
    'parsing': 'Parsing HTML...',
    'css-routing': 'Routing CSS...',
    'generating': 'Generating Webflow nodes...',
    'validating': 'Validating output...',
    'complete': 'Complete!',
  };
  return labels[phase] || phase;
}

// ============================================
// COMPONENTS
// ============================================

/**
 * Progress bar showing conversion progress
 */
export function ConversionProgressBar({
  progress,
  onCancel,
  className,
  showTiming = true,
  showCurrentItem = true,
}: ConversionProgressBarProps) {
  if (!progress) return null;

  const isComplete = progress.phase === 'complete';

  return (
    <div className={cn('space-y-2 p-4 rounded-lg border bg-background', className)}>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {getPhaseLabel(progress.phase)}
        </span>
        <span className="text-sm text-muted-foreground">
          {progress.percentage}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            'h-full transition-all duration-300 ease-out',
            isComplete ? 'bg-green-500' : 'bg-primary'
          )}
          style={{ width: `${progress.percentage}%` }}
        />
      </div>

      {/* Details row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {/* Current item */}
        {showCurrentItem && progress.currentItem && (
          <span className="truncate max-w-[200px]" title={progress.currentItem}>
            {progress.currentItem}
          </span>
        )}
        {(!showCurrentItem || !progress.currentItem) && <span />}

        {/* Timing */}
        {showTiming && (
          <span>
            {formatTime(progress.elapsedMs)} elapsed
            {progress.estimatedRemainingMs && !isComplete && (
              <> · ~{formatTime(progress.estimatedRemainingMs)} remaining</>
            )}
          </span>
        )}
      </div>

      {/* Cancel button */}
      {onCancel && !isComplete && (
        <button
          onClick={onCancel}
          className={cn(
            'text-xs text-muted-foreground hover:text-foreground',
            'underline underline-offset-2'
          )}
        >
          Cancel
        </button>
      )}
    </div>
  );
}

/**
 * List of completed sections with status icons
 */
export function SectionList({
  sections,
  className,
  maxVisible = 5,
}: SectionListProps) {
  if (sections.length === 0) return null;

  const visibleSections = sections.slice(-maxVisible);
  const hiddenCount = sections.length - maxVisible;

  return (
    <div className={cn('space-y-1', className)}>
      {hiddenCount > 0 && (
        <div className="text-xs text-muted-foreground">
          +{hiddenCount} more sections...
        </div>
      )}

      {visibleSections.map((section) => {
        const hasErrors = section.issues.some(
          (i) => i.severity === 'fatal' || i.severity === 'error'
        );
        const hasWarnings = section.issues.some(
          (i) => i.severity === 'warning'
        );

        return (
          <div
            key={section.sectionId}
            className="flex items-center gap-2 text-sm"
          >
            {/* Status icon */}
            {hasErrors ? (
              <span className="text-red-500">✕</span>
            ) : hasWarnings ? (
              <span className="text-yellow-500">⚠</span>
            ) : (
              <span className="text-green-500">✓</span>
            )}

            {/* Section name */}
            <span className="truncate">{section.sectionName}</span>

            {/* Node count */}
            <span className="text-xs text-muted-foreground ml-auto">
              {section.nodes.length} nodes
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Overall conversion status summary
 */
export function ConversionStatus({
  isConverting,
  isCancelled,
  isComplete,
  errorCount,
  warningCount,
  totalTimeMs,
  className,
}: ConversionStatusProps) {
  // Determine status
  let statusText: string;
  let statusColor: string;

  if (isCancelled) {
    statusText = 'Cancelled';
    statusColor = 'text-muted-foreground';
  } else if (isConverting) {
    statusText = 'Converting...';
    statusColor = 'text-primary';
  } else if (isComplete) {
    if (errorCount > 0) {
      statusText = `Completed with ${errorCount} error${errorCount > 1 ? 's' : ''}`;
      statusColor = 'text-red-500';
    } else if (warningCount > 0) {
      statusText = `Completed with ${warningCount} warning${warningCount > 1 ? 's' : ''}`;
      statusColor = 'text-yellow-500';
    } else {
      statusText = 'Completed successfully';
      statusColor = 'text-green-500';
    }
  } else {
    statusText = 'Ready';
    statusColor = 'text-muted-foreground';
  }

  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      <span className={cn('font-medium', statusColor)}>{statusText}</span>

      {totalTimeMs !== null && isComplete && (
        <span className="text-muted-foreground">
          ({formatTime(totalTimeMs)})
        </span>
      )}
    </div>
  );
}

/**
 * Compact inline progress indicator
 */
export function InlineProgress({
  progress,
  className,
}: {
  progress: ConversionProgress | null;
  className?: string;
}) {
  if (!progress) return null;

  const isComplete = progress.phase === 'complete';

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      {/* Spinner or check */}
      {isComplete ? (
        <span className="text-green-500">✓</span>
      ) : (
        <span className="animate-spin">⟳</span>
      )}

      {/* Percentage */}
      <span className="text-sm tabular-nums">
        {progress.percentage}%
      </span>

      {/* Phase */}
      <span className="text-xs text-muted-foreground">
        {getPhaseLabel(progress.phase)}
      </span>
    </div>
  );
}

// ============================================
// COMPOSED COMPONENTS
// ============================================

interface ConversionProgressPanelProps {
  progress: ConversionProgress | null;
  sections: SectionResult[];
  isConverting: boolean;
  isCancelled: boolean;
  isComplete: boolean;
  errorCount: number;
  warningCount: number;
  totalTimeMs: number | null;
  onCancel?: () => void;
  className?: string;
}

/**
 * Full conversion progress panel with all information
 */
export function ConversionProgressPanel({
  progress,
  sections,
  isConverting,
  isCancelled,
  isComplete,
  errorCount,
  warningCount,
  totalTimeMs,
  onCancel,
  className,
}: ConversionProgressPanelProps) {
  // Don't show anything if not converting and not complete
  if (!isConverting && !isComplete && !isCancelled) {
    return null;
  }

  return (
    <div className={cn('space-y-4 p-4 rounded-lg border bg-card', className)}>
      {/* Status header */}
      <ConversionStatus
        isConverting={isConverting}
        isCancelled={isCancelled}
        isComplete={isComplete}
        errorCount={errorCount}
        warningCount={warningCount}
        totalTimeMs={totalTimeMs}
      />

      {/* Progress bar (only during conversion) */}
      {isConverting && (
        <ConversionProgressBar
          progress={progress}
          onCancel={onCancel}
          showTiming
          showCurrentItem
        />
      )}

      {/* Section list */}
      {sections.length > 0 && (
        <div className="pt-2 border-t">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">
            Processed Sections ({sections.length})
          </h4>
          <SectionList sections={sections} maxVisible={5} />
        </div>
      )}
    </div>
  );
}
