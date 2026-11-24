import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '../context/ThemeContext'
import { radii, spacing, type ThemeColors } from '../theme/colors'
import {
  hasActiveHistoryFilters,
  type HistoryAreaOption,
  type HistoryDatePreset,
  type HistoryDecisionFilter,
  type HistoryFilterState,
} from '../utils/historyFilters'

interface HistoryFilterBarProps {
  filters: HistoryFilterState
  areaOptions: HistoryAreaOption[]
  onChangeFilters: (next: HistoryFilterState) => void
  onResetFilters: () => void
}

const DECISION_OPTIONS: Array<{ value: HistoryDecisionFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'granted', label: 'Permitidos' },
  { value: 'denied', label: 'Denegados' },
]

const DATE_PRESET_OPTIONS: Array<{ value: HistoryDatePreset; label: string }> = [
  { value: 'all', label: 'Todo' },
  { value: 'today', label: 'Hoy' },
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
]

/**
 * Barra compacta de filtros horizontales para el historial de accesos:
 * decisión (todos, permitidos, denegados), período y área.
 */
export function HistoryFilterBar({
  filters,
  areaOptions,
  onChangeFilters,
  onResetFilters,
}: HistoryFilterBarProps) {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const hasActiveFilters = hasActiveHistoryFilters(filters)

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowContent}
      >
        {DECISION_OPTIONS.map((option) => {
          const selected = filters.decision === option.value
          return (
            <Pressable
              key={option.value}
              onPress={() => onChangeFilters({ ...filters, decision: option.value })}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.chip,
                selected ? styles.chipActive : styles.chipInactive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  selected ? styles.chipTextActive : styles.chipTextInactive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          )
        })}

        <View style={styles.separator} />

        {DATE_PRESET_OPTIONS.map((option) => {
          const selected = filters.datePreset === option.value
          return (
            <Pressable
              key={option.value}
              onPress={() =>
                onChangeFilters({ ...filters, datePreset: option.value })
              }
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.chip,
                selected ? styles.chipActive : styles.chipInactive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  selected ? styles.chipTextActive : styles.chipTextInactive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {areaOptions.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rowContent}
        >
          <Pressable
            onPress={() => onChangeFilters({ ...filters, areaId: null })}
            accessibilityRole="button"
            accessibilityState={{ selected: filters.areaId === null }}
            style={[
              styles.chip,
              filters.areaId === null ? styles.chipActive : styles.chipInactive,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                filters.areaId === null
                  ? styles.chipTextActive
                  : styles.chipTextInactive,
              ]}
            >
              Todas las áreas
            </Text>
          </Pressable>

          {areaOptions.map((area) => {
            const selected = filters.areaId === area.id
            return (
              <Pressable
                key={area.id}
                onPress={() => onChangeFilters({ ...filters, areaId: area.id })}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.chip,
                  selected ? styles.chipActive : styles.chipInactive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    selected ? styles.chipTextActive : styles.chipTextInactive,
                  ]}
                >
                  {area.name}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
      ) : null}

      {hasActiveFilters ? (
        <View style={styles.resetRow}>
          <Pressable
            onPress={onResetFilters}
            accessibilityRole="button"
            accessibilityLabel="Limpiar filtros"
            style={({ pressed }) => [
              styles.resetButton,
              pressed && styles.resetButtonPressed,
            ]}
          >
            <Text style={styles.resetText}>Limpiar filtros</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
      paddingVertical: spacing.sm,
      gap: spacing.xs,
    },
    rowContent: {
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      gap: spacing.xs,
    },
    separator: {
      width: 1,
      alignSelf: 'stretch',
      marginVertical: spacing.xs,
      backgroundColor: colors.borderSubtle,
      marginHorizontal: spacing.xs,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radii.pill,
      borderWidth: 1,
    },
    chipActive: {
      backgroundColor: colors.brandSoft,
      borderColor: colors.brandBorder,
    },
    chipInactive: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.borderSubtle,
    },
    chipText: {
      fontSize: 12,
    },
    chipTextActive: {
      color: colors.brand,
      fontWeight: '700',
    },
    chipTextInactive: {
      color: colors.textSecondary,
      fontWeight: '500',
    },
    resetRow: {
      paddingHorizontal: spacing.lg,
      alignItems: 'flex-end',
    },
    resetButton: {
      paddingVertical: 2,
      paddingHorizontal: spacing.xs,
    },
    resetButtonPressed: {
      opacity: 0.7,
    },
    resetText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.brand,
    },
  })
}
