import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import CheckBox from '@react-native-community/checkbox';
import {
  BatteryCharging,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  RotateCcw,
  Share2,
  SlidersHorizontal,
  Zap,
} from 'lucide-react-native';

import { SETTINGS_CATEGORIES } from './SettingsConfig';

const CATEGORY_ICONS = {
  sync: Share2,
  service: RotateCcw,
  performance: Zap,
  help: CircleHelp,
};

const ICON_COLOR = '#cfd2d6';

export default function SettingsPage({
  data,
  handleInputChange,
  applyRuntimeSettings,
  openBatteryOptimizationSettings,
  openPowerManagerSettings,
  onBack,
}) {
  const [activeCategoryId, setActiveCategoryId] = useState(null);

  const activeCategory = SETTINGS_CATEGORIES.find(
    category => category.id === activeCategoryId,
  );

  const handleFieldChange = field => value => {
    const nextValue =
      field.type === 'number' && isNaN(Number(value))
        ? data[field.key]
        : value.trim();

    handleInputChange(field.key, nextValue);
  };

  const renderHeader = title => (
    <View style={styles.header}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={
          activeCategory ? 'Back to settings categories' : 'Back to home'
        }
        style={styles.iconButton}
        onPress={() => {
          if (activeCategory) {
            setActiveCategoryId(null);
          } else {
            onBack();
          }
        }}
      >
        <ChevronLeft color="white" size={24} />
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  const renderCategoryList = () => (
    <>
      {renderHeader('Settings')}
      <View style={styles.categoryList}>
        {SETTINGS_CATEGORIES.map(category => {
          const CategoryIcon = CATEGORY_ICONS[category.id] || SlidersHorizontal;

          return (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Open ${category.title} settings`}
              key={category.id}
              style={styles.categoryRow}
              onPress={() => setActiveCategoryId(category.id)}
            >
              <View style={styles.categoryIcon}>
                <CategoryIcon color={ICON_COLOR} size={22} />
              </View>
              <View style={styles.categoryText}>
                <Text style={styles.categoryTitle}>{category.title}</Text>
                <Text style={styles.categoryDescription}>
                  {category.description}
                </Text>
              </View>
              <ChevronRight color={ICON_COLOR} size={22} />
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );

  const renderSettingField = field => {
    if (field.type === 'boolean') {
      return (
        <View style={styles.settingRow} key={field.key}>
          <Text style={styles.settingLabel}>{field.label}</Text>
          <CheckBox
            value={data[field.key] === 'true'}
            onValueChange={newValue =>
              handleInputChange(field.key, String(newValue))
            }
          />
        </View>
      );
    }

    return (
      <View style={styles.settingBlock} key={field.key}>
        <Text style={styles.settingLabel}>{field.label}</Text>
        <TextInput
          style={styles.input}
          value={data[field.key]}
          onChangeText={handleFieldChange(field)}
          keyboardType={field.type === 'number' ? 'numeric' : 'default'}
        />
      </View>
    );
  };

  const renderSaveButton = () => {
    const hasPersistedFields = activeCategory?.fields?.some(
      field => field.persisted !== false,
    );

    if (!hasPersistedFields) {
      return null;
    }

    return (
      <TouchableOpacity
        accessibilityRole="button"
        style={[styles.actionButton, styles.saveButton]}
        onPress={applyRuntimeSettings}
      >
        <Text style={styles.actionButtonText}>Save Settings</Text>
      </TouchableOpacity>
    );
  };

  const renderPerformance = () => (
    <View style={styles.section}>
      <Text style={styles.bodyText}>
        Use these Android screens to reduce background service interruptions.
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        style={[styles.actionButton, styles.darkButton]}
        onPress={openBatteryOptimizationSettings}
      >
        <BatteryCharging color="white" size={18} />
        <Text style={styles.actionButtonText}>
          Battery Optimization Settings
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        style={[styles.actionButton, styles.darkButton]}
        onPress={openPowerManagerSettings}
      >
        <Zap color="white" size={18} />
        <Text style={styles.actionButtonText}>Power Manager Settings</Text>
      </TouchableOpacity>
    </View>
  );

  const renderHelp = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Clipboard Sharing on Android 10+</Text>
      <Text style={styles.bodyText}>
        On Android 10 and above, clipboard monitoring has been restricted for
        privacy reasons. To share clipboard content using ClipCascade:
      </Text>
      <View style={styles.steps}>
        <Text style={styles.bodyText}>
          1. Select the text, image, or file(s) you want to copy.
        </Text>
        <Text style={styles.bodyText}>
          2. Tap 'Share', select 'ClipCascade'.
        </Text>
        <Text style={styles.bodyText}>   (or)</Text>
        <Text style={styles.bodyText}>
          Tap 'ClipCascade' instead of 'Copy'.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Background Clipboard Reception</Text>
      <Text style={styles.bodyText}>
        ClipCascade automatically receives clipboard content in the background.
        No manual action is required to receive data.
      </Text>

      <Text style={styles.sectionTitle}>Automatic Clipboard Monitoring Setup</Text>
      <Text style={styles.bodyText}>
        On rooted/non-rooted devices, run these ADB commands to enable automatic
        clipboard monitoring:
      </Text>
      <Text selectable style={styles.commandText}>
        {`adb -d shell pm grant com.darkaxt.clipcascade android.permission.READ_LOGS`}
      </Text>
      <Text selectable style={styles.commandText}>
        {`adb -d shell appops set com.darkaxt.clipcascade SYSTEM_ALERT_WINDOW allow`}
      </Text>
      <Text selectable style={styles.commandText}>
        {`adb -d shell am force-stop com.darkaxt.clipcascade`}
      </Text>
    </View>
  );

  const renderCategoryPage = () => (
    <>
      {renderHeader(activeCategory.title)}
      <View style={styles.section}>
        <Text style={styles.categoryDescription}>
          {activeCategory.description}
        </Text>
        {activeCategory.fields.map(renderSettingField)}
        {activeCategory.id === 'performance' && renderPerformance()}
        {activeCategory.id === 'help' && renderHelp()}
        {renderSaveButton()}
      </View>
    </>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {activeCategory ? renderCategoryPage() : renderCategoryList()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 20,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: '#202124',
    borderRadius: 5,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  headerSpacer: {
    width: 42,
  },
  title: {
    color: '#d8d9db',
    flex: 1,
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  categoryList: {
    gap: 12,
  },
  categoryRow: {
    alignItems: 'center',
    backgroundColor: '#202124',
    borderRadius: 6,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  categoryIcon: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  categoryText: {
    flex: 1,
  },
  categoryTitle: {
    color: '#f4f4f5',
    fontSize: 18,
    fontWeight: 'bold',
  },
  categoryDescription: {
    color: '#bfc2c7',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  section: {
    gap: 16,
  },
  settingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  settingBlock: {
    gap: 8,
  },
  settingLabel: {
    color: '#d8d9db',
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
  },
  input: {
    backgroundColor: '#1f2023',
    borderColor: '#555a60',
    borderRadius: 5,
    borderWidth: 1,
    color: '#f4f4f5',
    padding: 10,
  },
  actionButton: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 5,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
    maxWidth: 340,
    minHeight: 44,
    minWidth: 180,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  saveButton: {
    backgroundColor: '#006b3c',
  },
  darkButton: {
    backgroundColor: '#050505',
  },
  actionButtonText: {
    color: 'white',
    flexShrink: 1,
    fontSize: 16,
    textAlign: 'center',
  },
  sectionTitle: {
    color: '#d8d9db',
    fontSize: 17,
    fontWeight: 'bold',
    marginTop: 6,
  },
  bodyText: {
    color: '#d0d2d6',
    fontSize: 16,
    lineHeight: 23,
  },
  steps: {
    gap: 4,
    paddingLeft: 12,
  },
  commandText: {
    backgroundColor: '#17181a',
    borderRadius: 5,
    color: '#f4f4f5',
    fontSize: 13,
    lineHeight: 19,
    padding: 10,
  },
});
