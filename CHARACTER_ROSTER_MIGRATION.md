# Character Roster Migration - Backward Compatibility Fix

## Issue

After implementing the new multi-character roster system, existing workflow steps (Step3Variations, Step4Story) were still expecting the old single-character structure (`presetCharacter` or `customCharacter`), causing errors when trying to access `undefined` properties.

**Error:** `TypeError: Cannot read properties of undefined (reading 'name')`

## Solution

Updated all components to support **both** the new multi-character roster system and the legacy single-character system for backward compatibility.

## Changes Made

### 1. Step3Variations.tsx ✅

**Before:**
```typescript
const character = state.characterType === 'preset' 
  ? {
      name: state.presetCharacter!.name,
      age: state.presetCharacter!.defaultAge,
      traits: state.presetCharacter!.traits,
    }
  : {
      name: state.customCharacter!.name,
      age: state.customCharacter!.age,
      traits: state.customCharacter!.traits,
    };
```

**After:**
```typescript
let character;

if (state.characterRoster && state.characterRoster.main) {
  // NEW: Multi-character roster system
  const mainChar = state.characterRoster.main;
  character = {
    name: mainChar.name,
    age: parseInt(state.characterRoster.ageBand.split('-')[0]) || 6,
    traits: mainChar.customPrompt 
      ? ['creative', 'unique', 'special']
      : [],
  };
} else if (state.characterType === 'preset' && state.presetCharacter) {
  // LEGACY: Preset character
  character = {
    name: state.presetCharacter.name,
    age: state.presetCharacter.defaultAge,
    traits: state.presetCharacter.traits,
  };
} else if (state.customCharacter) {
  // LEGACY: Custom character
  character = {
    name: state.customCharacter.name,
    age: state.customCharacter.age,
    traits: state.customCharacter.traits,
  };
} else {
  throw new Error('No character data found. Please go back and create a character.');
}

// Also updated to use style from characterSetOption if available
const style = state.selectedCharacterSetOption?.styleLock.styleFamily 
  || state.artStyle?.technicalName 
  || 'watercolor';

const palette = state.selectedCharacterSetOption?.styleLock.palette 
  || (state.colorPalette?.technicalDescription.split(',').map(s => s.trim()))
  || ['pink', 'purple', 'blue'];
```

### 2. Step4Story.tsx ✅

**Before:**
```typescript
const characterName = state.characterType === 'preset'
  ? state.presetCharacter?.name
  : state.customCharacter?.name;
```

**After:**
```typescript
const characterName = state.characterRoster?.main?.name
  || (state.characterType === 'preset' ? state.presetCharacter?.name : state.customCharacter?.name)
  || 'Hero';
```

### 3. Step5Covers.tsx ✅

No changes needed - doesn't reference character structure directly.

## Migration Strategy

The updated code follows this priority order:

1. **First**: Check for new `characterRoster` system
2. **Fallback**: Use legacy `presetCharacter` or `customCharacter`
3. **Default**: Provide sensible defaults to prevent crashes

This ensures:
- ✅ New multi-character flow works perfectly
- ✅ Legacy single-character flow continues working
- ✅ Users can switch between flows without issues
- ✅ Existing books in progress won't break

## Data Flow

### New System (Multi-Character)
```
Step 1.1 (Hub) → Step 1.2 (Props) → Step 1.3 (Sets)
         ↓                                    ↓
   characterRoster                  selectedCharacterSetOption
         ↓                                    ↓
      Step 3 → Uses roster.main + styleLock.styleFamily
         ↓
      Step 4 → Uses roster.main.name for title
```

### Legacy System (Single Character)
```
Old Step 1 → Step 2 (Style) → Step 3
      ↓            ↓              ↓
presetCharacter  artStyle   Uses presetCharacter/customCharacter
or customCharacter   +       + artStyle/colorPalette
                 colorPalette
```

## Testing

Tested scenarios:
1. ✅ New flow: Create character roster → Complete all steps
2. ✅ Legacy flow: Use old Step1Hero → Complete all steps
3. ✅ Error handling: Missing character data → Graceful error message
4. ✅ No linter errors
5. ✅ Type safety maintained

## Future Cleanup

Once all users have migrated to the new flow (and no old sessions exist), we can:

1. Remove legacy character type checks
2. Make `characterRoster` required in `CreateFlowState`
3. Remove `presetCharacter` and `customCharacter` fields
4. Simplify all component logic to only handle roster

For now, maintaining backward compatibility is critical for a smooth rollout.

## Summary

✅ Fixed `TypeError` in Step3Variations
✅ Updated Step4Story for compatibility
✅ Maintained backward compatibility
✅ Zero breaking changes
✅ Graceful error handling
✅ Type-safe implementation

