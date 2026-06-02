import { ModerationReportActionTaken, ModerationReportStatus } from '@/api/models'
import type { ModerationReport } from '@/api/models'
import type { ModerationAction, Report } from '@/shared/types/report'

export const isOnline = true
export const forceOnlineWithoutAuth = true

export const reasonFilterMap = {
  spam: ['SPAM'],
  'hate-speech': ['HATE_SPEECH'],
  misinformation: ['MISINFORMATION'],
  harassment: ['HARASSMENT'],
  'adult-content': ['ADULT_CONTENT', 'EXPLICIT_CONTENT'],
} as const

export type SidebarStatusFilter = 'queue' | 'pending' | 'resolved' | 'escalated'

export const normalizeReasonKey = (reason: string) =>
  reason.trim().replaceAll(' ', '_').replaceAll('-', '_').toUpperCase()

export const parseSidebarStatusFilter = (value: string | null): SidebarStatusFilter => {
  if (value === 'pending') return 'pending'
  if (value === 'resolved') return 'resolved'
  if (value === 'escalated') return 'escalated'
  return 'queue'
}

export const matchesSearchQuery = (report: Report, query: string) => {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true

  const searchHaystack = [
    report.id,
    report.title,
    report.description,
    report.status,
    report.targetType,
    report.reportReason,
    report.reporter.id,
    report.reporter.name,
    report.author.id,
    report.author.name,
    ...report.auditTrail.map((entry) => `${entry.actorId} ${entry.action} ${entry.timestamp}`),
  ]
    .join(' ')
    .toLowerCase()

  return searchHaystack.includes(normalizedQuery)
}

const getReportId = (report: ModerationReport, index: number): string => {
  if (typeof report._id === 'string') return report._id
  if (report._id?.timestamp) return String(report._id.timestamp)
  if (report._id?.date) return report._id.date
  if (report.activeReportKey) return report.activeReportKey
  if (report.targetId) return report.targetId
  return `report-${index + 1}`
}

const toTitleCase = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')

const mapStatus = (report: ModerationReport): Report['status'] => {
  if (
    report.status === ModerationReportStatus.RESOLVED &&
    report.actionTaken === ModerationReportActionTaken.DISMISS
  ) {
    return 'DISMISSED'
  }

  switch (report.status) {
    case ModerationReportStatus.ESCALATED:
      return 'ESCALATED_TO_HUMAN'
    case ModerationReportStatus.RESOLVED:
      return 'RESOLVED'
    case ModerationReportStatus.AI_SCREENING:
    case ModerationReportStatus.PENDING:
    default:
      return 'PENDING'
  }
}

const mapResolvedAction = (
  actionTaken?: (typeof ModerationReportActionTaken)[keyof typeof ModerationReportActionTaken]
): ModerationAction | undefined => {
  switch (actionTaken) {
    case ModerationReportActionTaken.REMOVE_CONTENT:
      return 'REMOVE_CONTENT'
    case ModerationReportActionTaken.BAN_AUTHOR:
      return 'BAN_AUTHOR'
    case ModerationReportActionTaken.WARN:
      return 'WARN_AUTHOR'
    case ModerationReportActionTaken.DISMISS:
      return 'DISMISS'
    default:
      return undefined
  }
}

export const toCardReport = (report: ModerationReport, index: number): Report => {
  const id = getReportId(report, index)
  const reason = report.reason ? toTitleCase(report.reason) : 'Other'

  return {
    id,
    title: reason,
    description: report.details?.trim() || 'No report details provided.',
    status: mapStatus(report),
    targetType: report.targetType ?? 'POST',
    reportReason: reason,
    aiConfidenceScore: report.aiConfidenceScore ?? 0,
    createdAt: report.createdAt ?? new Date(0).toISOString(),
    reporter: {
      id: report.reporterId ?? 'unknown-reporter',
      name: report.reporterId ?? 'Unknown reporter',
    },
    author: {
      id: report.targetAuthorId ?? 'unknown-author',
      name: report.targetAuthorId ?? 'Unknown author',
      priorReportCount: 0,
    },
    resolvedAction: mapResolvedAction(report.actionTaken),
    auditTrail: (report.auditEntries ?? []).map((entry, auditIndex) => ({
      id: `${id}-audit-${auditIndex}`,
      actorId: entry.actor ?? 'system',
      action: entry.message ?? 'No audit message',
      timestamp: entry.createdAt ?? report.updatedAt ?? report.createdAt ?? '',
    })),
  }
}

export const filterReportsBySidebarStatus = (
  reports: Report[],
  sidebarStatusFilter: SidebarStatusFilter
) => {
  if (sidebarStatusFilter === 'pending') {
    return reports.filter((report) => report.status === 'PENDING')
  }

  if (sidebarStatusFilter === 'resolved') {
    return reports.filter((report) => report.status === 'RESOLVED' || report.status === 'DISMISSED')
  }

  if (sidebarStatusFilter === 'escalated') {
    return reports.filter((report) => report.status === 'ESCALATED_TO_HUMAN')
  }

  return reports
}

export const getSidebarStatusCounts = (reports: Report[]) => ({
  queue: reports.length,
  pending: reports.filter((report) => report.status === 'PENDING').length,
  resolved: reports.filter(
    (report) => report.status === 'RESOLVED' || report.status === 'DISMISSED'
  ).length,
  escalated: reports.filter((report) => report.status === 'ESCALATED_TO_HUMAN').length,
})

const matchesReasonFilter = (report: Report, filterKey: keyof typeof reasonFilterMap) =>
  reasonFilterMap[filterKey].includes(normalizeReasonKey(report.reportReason))

export const getReasonCounts = (reports: Report[]) => ({
  spam: reports.filter((report) => matchesReasonFilter(report, 'spam')).length,
  'hate-speech': reports.filter((report) => matchesReasonFilter(report, 'hate-speech')).length,
  misinformation: reports.filter((report) => matchesReasonFilter(report, 'misinformation')).length,
  harassment: reports.filter((report) => matchesReasonFilter(report, 'harassment')).length,
  'adult-content': reports.filter((report) => matchesReasonFilter(report, 'adult-content')).length,
})

export const reportMatchesReasonFilter = (
  report: Report,
  filterKey: keyof typeof reasonFilterMap
) => matchesReasonFilter(report, filterKey)

export const applyReportOverrides = (
  reports: Report[],
  reportOverrides: Record<string, Partial<Report>>
) =>
  reports.map((report) =>
    reportOverrides[report.id] ? { ...report, ...reportOverrides[report.id] } : report
  )
