import { useContext, useMemo, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'

import { ChipGroup } from '@/Chip'
import { useGetReports, useModerateReport } from '@/api/endpoints/reports/reports'
import { GetReportsStatus, ModerateReportRequestAction } from '@/api/models'
import type {
  GetReportsParams,
  ModerateReportRequestAction as ModerateReportRequestActionType,
} from '@/api/models'
import AuthContext from '@/context/AuthContext'
import {
  applyReportOverrides,
  filterReportsBySidebarStatus,
  forceOnlineWithoutAuth,
  getReasonCounts,
  isOnline,
  matchesSearchQuery,
  parseSidebarStatusFilter,
  reasonFilterMap,
  reportMatchesReasonFilter,
  toCardReport,
} from '@/features/reports/reportViewModel'
import type { AdminLayoutOutletContext } from '@/layouts/AdminLayout'

import ReportCard from '@/shared/composites/ReportCard'
import type { ModerationAction } from '@/shared/composites/ReportCard/ReportCard'
import { reports as dummyReports } from '@/shared/composites/ReportCard/dummyData'

import MetricCard from '@/shared/composites/MetricCard'
import EmptyState from '@/shared/composites/EmptyState'
import { toast } from '@/shared/integrations/Toast'

import { SearchWindowIcon } from '@/shared/illustrations/NoResutsFoundIcon'

const actionRequestMap: Record<ModerationAction, ModerateReportRequestActionType | undefined> = {
  RUN_AI_SCREENING: undefined,
  REMOVE_CONTENT: ModerateReportRequestAction.REMOVE_CONTENT,
  BAN_AUTHOR: ModerateReportRequestAction.BAN_AUTHOR,
  WARN_AUTHOR: ModerateReportRequestAction.WARN,
  DISMISS: ModerateReportRequestAction.DISMISS,
}

const actionToastMap: Record<ModerationAction, string> = {
  RUN_AI_SCREENING: 'AI screening started successfully',
  REMOVE_CONTENT: 'Reported content removed successfully',
  BAN_AUTHOR: 'Author banned by moderator successfully',
  WARN_AUTHOR: 'Author warned by moderator successfully',
  DISMISS: 'Report dismissed by moderator successfully',
}

const actionStatusMap: Record<ModerationAction, 'PENDING' | 'RESOLVED' | 'DISMISSED'> = {
  RUN_AI_SCREENING: 'PENDING',
  REMOVE_CONTENT: 'RESOLVED',
  BAN_AUTHOR: 'RESOLVED',
  WARN_AUTHOR: 'RESOLVED',
  DISMISS: 'DISMISSED',
}

const LoginPage = () => {
  const [searchParams] = useSearchParams()
  const { reportOverrides, updateReport } = useOutletContext<AdminLayoutOutletContext>()
  const { isAuthenticated } = useContext(AuthContext)
  const [selected, setSelected] = useState('all')
  const sidebarStatusFilter = parseSidebarStatusFilter(searchParams.get('status'))
  const searchQuery = searchParams.get('q') ?? ''
  const shouldFetchOnlineReports = isOnline && isAuthenticated
  const reportQueryParams = useMemo<GetReportsParams | undefined>(() => {
    if (sidebarStatusFilter === 'pending') {
      return { status: GetReportsStatus.PENDING }
    }

    if (sidebarStatusFilter === 'resolved') {
      return { status: GetReportsStatus.RESOLVED }
    }

    if (sidebarStatusFilter === 'escalated') {
      return undefined
    }

    return undefined
  }, [sidebarStatusFilter])

  const { data: reportsResponse, isLoading } = useGetReports(reportQueryParams, {
    query: { enabled: shouldFetchOnlineReports },
  })
  const moderateReportMutation = useModerateReport()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const onlineReports = useMemo(
    () => (reportsResponse?.status === 200 ? reportsResponse.data.map(toCardReport) : []),
    [reportsResponse]
  )
  const reports = useMemo(() => {
    if (isOnline) {
      if (isAuthenticated) {
        return onlineReports
      }

      return forceOnlineWithoutAuth ? [] : dummyReports
    }

    return dummyReports
  }, [isAuthenticated, onlineReports])
  const activeReports = useMemo(
    () => applyReportOverrides(reports, reportOverrides),
    [reportOverrides, reports]
  )

  const statusScopedReports = useMemo(
    () => filterReportsBySidebarStatus(activeReports, sidebarStatusFilter),
    [activeReports, sidebarStatusFilter]
  )
  const reasonCounts = useMemo(() => getReasonCounts(statusScopedReports), [statusScopedReports])

  const filteredReports = useMemo(() => {
    const next = statusScopedReports

    if (selected === 'all') return next

    const selectedReason = selected as keyof typeof reasonFilterMap
    if (!(selectedReason in reasonFilterMap)) return next

    return next.filter((report) => reportMatchesReasonFilter(report, selectedReason))
  }, [selected, statusScopedReports])

  const visibleReports = useMemo(
    () => filteredReports.filter((report) => matchesSearchQuery(report, searchQuery)),
    [filteredReports, searchQuery]
  )

  const metricCardData = useMemo(() => {
    const pendingCount = activeReports.filter((report) => report.status === 'PENDING').length
    const resolvedCount = activeReports.filter(
      (report) => report.status === 'RESOLVED' || report.status === 'DISMISSED'
    ).length
    const aiAutoResolvedCount = activeReports.filter(
      (report) =>
        (report.status === 'RESOLVED' || report.status === 'DISMISSED') && !report.resolvedAction
    ).length
    const escalatedCount = activeReports.filter(
      (report) => report.status === 'ESCALATED_TO_HUMAN'
    ).length
    const escalationRate =
      activeReports.length === 0
        ? '0%'
        : `${Math.round((escalatedCount / activeReports.length) * 100)}%`

    return [
      {
        idx: 1,
        label: 'Pending',
        value: pendingCount,
        subLabel: 'awaiting action',
        valueColor: 'warning' as const,
      },
      {
        idx: 2,
        label: 'Resolved',
        value: resolvedCount,
        subLabel: 'closed reports',
        valueColor: 'success' as const,
      },
      {
        idx: 3,
        label: 'AI Auto-resolved',
        value: aiAutoResolvedCount,
        subLabel: 'without moderator action',
        valueColor: 'success' as const,
      },
      {
        idx: 4,
        label: 'Escalation Rate',
        value: escalationRate,
        subLabel: 'of all reports',
        valueColor: 'default' as const,
      },
    ]
  }, [activeReports])

  const handleReportAction = async (reportId: string, action: ModerationAction) => {
    if (!isOnline) {
      updateReport(reportId, { status: actionStatusMap[action], resolvedAction: action })
      setExpandedId((currentExpandedId) =>
        currentExpandedId === reportId ? null : currentExpandedId
      )
      toast.success(actionToastMap[action])
      return
    }

    try {
      await moderateReportMutation.mutateAsync({
        id: reportId,
        data: {
          action: actionRequestMap[action],
          note: `Moderator action applied from admin demo: ${action}`,
        },
      })

      updateReport(reportId, { status: actionStatusMap[action], resolvedAction: action })
      setExpandedId((currentExpandedId) =>
        currentExpandedId === reportId ? null : currentExpandedId
      )
      toast.success(actionToastMap[action])
    } catch {
      toast.error('Unable to process report action right now')
    }
  }

  return (
    <div className="min-h-screen space-y-6">
      {/* Header */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metricCardData.map((item) => {
          return (
            <MetricCard
              key={item.idx}
              label={item.label}
              value={item.value}
              subLabel={item.subLabel}
              valueColor={item.valueColor}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-text-primary text-lg font-semibold">Active Reports</div>

        <ChipGroup
          selected={selected}
          onChange={(value) => {
            setSelected(value)

            console.log('Selected:', value)
          }}
          options={[
            {
              label: 'All',
              value: 'all',
            },

            {
              label: 'Spam',
              value: 'spam',
              count: reasonCounts.spam,
            },

            {
              label: 'Hate speech',
              value: 'hate-speech',
              count: reasonCounts['hate-speech'],
            },

            {
              label: 'Misinformation',
              value: 'misinformation',
              count: reasonCounts.misinformation,
            },

            {
              label: 'Harassment',
              value: 'harassment',
              count: reasonCounts.harassment,
            },

            {
              label: 'Adult Content',
              value: 'adult-content',
              count: reasonCounts['adult-content'],
            },
          ]}
        />
      </div>
      {/* <LoginCard /> */}
      {/* Report cards */}
      <div className="space-y-4">
        {shouldFetchOnlineReports && isLoading ? (
          <div className="text-text-secondary bg-bg-secondary rounded-lg px-4 py-6 text-sm">
            Loading reports...
          </div>
        ) : visibleReports.length === 0 ? (
          <EmptyState
            icon={<SearchWindowIcon size={72} className="text-text-tertiary" />}
            title="No results found."
            description="
          Try adjusting your filters
          or search query.
        "
            // action={{
            //   label: 'Clear filters',

            //   onClick: () => {
            //     setSelected('all')
            //   },
            // }}
          />
        ) : (
          visibleReports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              isExpanded={expandedId === report.id}
              onToggleExpand={() => {
                setExpandedId(expandedId === report.id ? null : report.id)
              }}
              onAction={handleReportAction}
              className="bg-bg-secondary cursor-pointer"
            />
          ))
        )}
      </div>
    </div>
  )
}

export default LoginPage
