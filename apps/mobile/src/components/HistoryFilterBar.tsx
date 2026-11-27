import { useEffect, useMemo, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { useTheme } from '../context/ThemeContext'
import { radii, spacing, type ThemeColors } from '../theme/colors'
import {
  countActiveHistoryFilters,
  DEFAULT_HISTORY_FILTERS,
  getActiveFilterSummaryLabels,
  HISTORY_DATE_CHECKLIST,
  HISTORY_DECISION_CHECKLIST,
  toggleAreaFilter,
  toggleDatePresetFilter,
  toggleDecisionFilter,
  type HistoryAreaOption,
  type HistoryFilterState,
} from '../utils/historyFilters'

interface HistoryFilterBarProps {
  filters: HistoryFilterState
  areaOptions: HistoryAreaOption[]
  onChangeFilters: (next: HistoryFilterState) => void
  onResetFilters: () => void
}

type Styles = ReturnType<typeof createStyles>

interface ChecklistRowProps {
  label: string
  checked: boolean
  onPress: () => void
  styles: Styles
}

function ChecklistRow({ label, checked, onPress, styles }: ChecklistRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.checkRow,
        pressed && styles.checkRowPressed,
      ]}
    >
      <View
        style={[
          styles.checkbox,
          checked ? styles.checkboxChecked : styles.checkboxUnchecked,
        ]}
      >
        {checked ? <Text style={styles.checkmark}>✓</Text> : null}
      </View>
      <Text style={[styles.checkLabel, checked && styles.checkLabelChecked]}>
        {label}
      </Text>
    </Pressable>
  )
}

/**
 * Barra compacta con modal de filtros con checklist para filtrar el historial
 * de accesos por resultado, período y área.
 */
export function HistoryFilterBar({
  filters,
  areaOptions,
  onChangeFilters,
  onResetFilters,
}: HistoryFilterBarProps) {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState<HistoryFilterState>(filters)

  useEffect(() => {
    setDraft(filters)
  }, [filters])

  const activeCount = countActiveHistoryFilters(filters)
  const activeLabels = useMemo(
    () => getActiveFilterSummaryLabels(filters, areaOptions),
    [filters, areaOptions],
  )

  const handleOpen = () => {
    setDraft(filters)
    setIsOpen(true)
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  const handleClearFromPanel = () => {
    setDraft(DEFAULT_HISTORY_FILTERS)
    onResetFilters()
    setIsOpen(false)
  }

  const handleApply = () => {
    onChangeFilters(draft)
    setIsOpen(false)
  }

  const toggleAccessibilityLabel =
    activeCount > 0 ? `Filtros, ${activeCount} activos` : 'Filtros'

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={handleOpen}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          accessibilityLabel={toggleAccessibilityLabel}
          style={({ pressed }) => [
            styles.toggleButton,
            isOpen && styles.toggleButtonOpen,
            pressed && styles.toggleButtonPressed,
          ]}
        >
          <Text style={styles.toggleText}>Filtros</Text>
          {activeCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeCount}</Text>
            </View>
          ) : null}
          <Text style={styles.arrow}>▾</Text>
        </Pressable>

        {activeCount > 0 ? (
          <Pressable
            onPress={onResetFilters}
            accessibilityRole="button"
            accessibilityLabel="Limpiar filtros"
            style={({ pressed }) => [
              styles.headerResetButton,
              pressed && styles.headerResetButtonPressed,
            ]}
          >
            <Text style={styles.headerResetText}>Limpiar</Text>
          </Pressable>
        ) : null}
      </View>

      {activeLabels.length > 0 ? (
        <Text style={styles.summaryText} numberOfLines={1}>
          {activeLabels.join(' · ')}
        </Text>
      ) : null}

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleClose}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Cerrar filtros"
          />

          <View style={styles.modalCard} accessibilityViewIsModal>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} accessibilityRole="header">
                Filtrar historial
              </Text>
              <Pressable
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="Cerrar filtros"
                style={({ pressed }) => [
                  styles.modalCloseButton,
                  pressed && styles.modalCloseButtonPressed,
                ]}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Resultado</Text>
                  <Text style={styles.sectionSubtitle}>Opcional</Text>
                </View>
                {HISTORY_DECISION_CHECKLIST.map((option) => (
                  <ChecklistRow
                    key={option.value}
                    label={option.label}
                    checked={draft.decision === option.value}
                    onPress={() =>
                      setDraft((prev) => ({
                        ...prev,
                        decision: toggleDecisionFilter(
                          prev.decision,
                          option.value,
                        ),
                      }))
                    }
                    styles={styles}
                  />
                ))}
              </View>

              <View style={styles.sectionDivider} />

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Período</Text>
                {HISTORY_DATE_CHECKLIST.map((option) => (
                  <ChecklistRow
                    key={option.value}
                    label={option.label}
                    checked={draft.datePreset === option.value}
                    onPress={() =>
                      setDraft((prev) => ({
                        ...prev,
                        datePreset: toggleDatePresetFilter(
                          prev.datePreset,
                          option.value,
                        ),
                      }))
                    }
                    styles={styles}
                  />
                ))}
              </View>

              {areaOptions.length > 0 ? (
                <>
                  <View style={styles.sectionDivider} />
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Área</Text>
                    {areaOptions.map((area) => (
                      <ChecklistRow
                        key={area.id}
                        label={area.name}
                        checked={draft.areaId === area.id}
                        onPress={() =>
                          setDraft((prev) => ({
                            ...prev,
                            areaId: toggleAreaFilter(prev.areaId, area.id),
                          }))
                        }
                        styles={styles}
                      />
                    ))}
                  </View>
                </>
              ) : null}
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                onPress={handleClearFromPanel}
                accessibilityRole="button"
                accessibilityLabel="Limpiar filtros"
                style={({ pressed }) => [
                  styles.footerButton,
                  styles.clearButton,
                  pressed && styles.clearButtonPressed,
                ]}
              >
                <Text style={styles.clearButtonText}>Limpiar</Text>
              </Pressable>

              <Pressable
                onPress={handleApply}
                accessibilityRole="button"
                accessibilityLabel="Aplicar filtros"
                style={({ pressed }) => [
                  styles.footerButton,
                  styles.applyButton,
                  pressed && styles.applyButtonPressed,
                ]}
              >
                <Text style={styles.applyButtonText}>Aplicar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      gap: spacing.xs,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    toggleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs + 2,
      minHeight: 36,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.surfaceElevated,
    },
    toggleButtonOpen: {
      borderColor: colors.brandBorder,
      backgroundColor: colors.brandSoft,
    },
    toggleButtonPressed: {
      opacity: 0.85,
    },
    toggleText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    badge: {
      minWidth: 18,
      height: 18,
      borderRadius: radii.pill,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.brandContrast,
    },
    arrow: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    headerResetButton: {
      minHeight: 32,
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    headerResetButtonPressed: {
      opacity: 0.7,
    },
    headerResetText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.brand,
    },
    summaryText: {
      fontSize: 12,
      color: colors.textMuted,
      paddingHorizontal: 2,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(18, 12, 24, 0.52)',
    },
    modalCard: {
      width: '100%',
      maxWidth: 440,
      maxHeight: '80%',
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 1,
      shadowRadius: 16,
      elevation: 8,
      overflow: 'hidden',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
      backgroundColor: colors.surfaceElevated,
    },
    modalTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    modalCloseButton: {
      width: 32,
      height: 32,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalCloseButtonPressed: {
      backgroundColor: colors.surfaceHover,
    },
    modalCloseText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    modalScroll: {
      flexShrink: 1,
    },
    modalContent: {
      paddingVertical: spacing.sm,
    },
    section: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.xs,
    },
    sectionSubtitle: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.textMuted,
    },
    sectionDivider: {
      height: 1,
      backgroundColor: colors.borderSubtle,
      marginVertical: spacing.xs,
    },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 44,
      gap: spacing.sm + 2,
      paddingHorizontal: spacing.xs,
      borderRadius: radii.sm,
    },
    checkRowPressed: {
      backgroundColor: colors.surfaceHover,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: {
      backgroundColor: colors.brand,
      borderColor: colors.brand,
    },
    checkboxUnchecked: {
      backgroundColor: colors.surface,
      borderColor: colors.borderStrong,
    },
    checkmark: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.brandContrast,
      lineHeight: 14,
    },
    checkLabel: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      color: colors.textPrimary,
    },
    checkLabelChecked: {
      fontWeight: '600',
    },
    footer: {
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
      backgroundColor: colors.surfaceElevated,
    },
    footerButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
    },
    clearButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    clearButtonPressed: {
      backgroundColor: colors.surfaceHover,
    },
    clearButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    applyButton: {
      backgroundColor: colors.brand,
    },
    applyButtonPressed: {
      backgroundColor: colors.brandHover,
    },
    applyButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.brandContrast,
    },
  })
}
