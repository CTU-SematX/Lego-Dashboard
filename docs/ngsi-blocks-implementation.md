# NGSI-LD Visualization Blocks - Implementation Checklist

## Tổng Quan

Tạo hệ thống blocks để hiển thị dữ liệu NGSI-LD trực tiếp từ Context Broker lên frontend.

### Kiến Trúc

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Browser)                       │
├─────────────────────────────────────────────────────────────────┤
│  NgsiCard Block    │  NgsiTable Block   │   NgsiMap Block       │
│        ↓           │         ↓          │         ↓             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              useNgsiData() Hook (Client)                │    │
│  │  - Fetch từ broker trực tiếp                            │    │
│  │  - Error handling + retry                               │    │
│  │  - Auto-refresh (polling)                               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              ↓                                   │
├─────────────────────────────────────────────────────────────────┤
│              NGSI-LD Context Broker (localhost:1026)             │
│              Headers: NGSILD-Tenant, Link (context)              │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Page render (Server)**: Payload CMS trả về block config (entity ID, source URL, attributes...)
2. **Client mount**: Block component gọi `useNgsiData()` hook
3. **Direct fetch**: Hook gọi trực tiếp đến broker URL với proper headers
4. **Display**: Render data với error/loading states

---

## Phase 1: Foundation

### Task 1.1: Tạo NGSI Client cho Browser

**File**: `src/lib/ngsi-ld/browser-client.ts`

**Mô tả**: Client để gọi NGSI-LD API từ browser, xử lý CORS và error handling.

```typescript
// Cấu trúc cần implement
export interface NgsiBrowserClientConfig {
  brokerUrl: string
  tenant?: string        // NGSILD-Tenant header (hoặc Fiware-Service - broker hỗ trợ cả 2)
  servicePath?: string   // Fiware-ServicePath header (optional)
  contextUrl?: string    // URL của @context file
}

export class NgsiBrowserClient {
  // GET /ngsi-ld/v1/entities/{id}
  async getEntity(entityId: string, options?: { attrs?: string }): Promise<NgsiEntity>
  
  // GET /ngsi-ld/v1/entities?type=X
  async queryEntities(options: QueryOptions): Promise<NgsiEntity[]>
}

// Error types
export class NgsiError extends Error {
  status: number
  code?: string
}
```

**Headers cần thiết cho GET request**:
```
Accept: application/json
Link: <{contextUrl}>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"
NGSILD-Tenant: {tenant}       (hoặc Fiware-Service: {tenant})
Fiware-ServicePath: {path}    (optional, default: /)
```

**Headers cho POST/PATCH với embedded context**:
```
Content-Type: application/ld+json
NGSILD-Tenant: {tenant}
// Body: { "@context": "contextUrl", ...data }
```

**Cách test**:
```bash
# Test trực tiếp từ terminal - dùng Fiware-Service (Orion-LD hỗ trợ cả 2)
curl -X GET 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:WeatherObserved:006' \
  -H 'Accept: application/json' \
  -H 'Fiware-Service: Cantho' \
  -H 'Fiware-ServicePath: /' \
  -H 'Link: <https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.8.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'

# Hoặc dùng NGSILD-Tenant (chuẩn NGSI-LD)
curl -X GET 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:WeatherObserved:006' \
  -H 'Accept: application/json' \
  -H 'NGSILD-Tenant: Cantho' \
  -H 'Link: <https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.8.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
```

**Debug CORS**:
```bash
# Nếu lỗi CORS, cần config Orion-LD
# Trong docker-compose.yml của Orion:
orion:
  environment:
    - ORIONLD_CORS_ALLOWED_ORIGIN=*
    # hoặc specific: http://localhost:3000
```

---

### Task 1.2: Tạo useNgsiData Hook

**File**: `src/blocks/NgsiBlocks/hooks/useNgsiData.ts`

**Mô tả**: React hook cho client components để fetch và auto-refresh data.

```typescript
'use client'

export interface UseNgsiDataOptions {
  brokerUrl: string
  entityId?: string           // Single entity mode
  entityType?: string         // Query mode
  tenant?: string
  contextUrl?: string
  attrs?: string[]            // Filter attributes
  refreshInterval?: number    // Seconds, 0 = disabled
  enabled?: boolean           // Conditional fetching
}

export interface UseNgsiDataResult<T> {
  data: T | null
  isLoading: boolean
  error: NgsiError | null
  refetch: () => Promise<void>
  lastUpdated: Date | null
}

export function useNgsiData<T = NgsiEntity>(options: UseNgsiDataOptions): UseNgsiDataResult<T>
```

**Cách test**:
```tsx
// Tạo test component tạm
'use client'
import { useNgsiData } from '@/blocks/NgsiBlocks/hooks/useNgsiData'

export function TestNgsiHook() {
  const { data, isLoading, error } = useNgsiData({
    brokerUrl: 'http://localhost:1026',
    entityId: 'urn:ngsi-ld:WeatherObserved:006',
    tenant: 'Cantho',
  })
  
  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  return <pre>{JSON.stringify(data, null, 2)}</pre>
}
```

**Debug**:
- Mở DevTools > Network tab, kiểm tra request headers
- Nếu CORS error: check broker config
- Nếu 404: check entityId và tenant

---

### Task 1.3: Tạo Shared Field Factory

**File**: `src/blocks/NgsiBlocks/fields/ngsiDataSource.ts`

**Mô tả**: Factory function tạo fields cho data source config, tái sử dụng cho tất cả NGSI blocks.

```typescript
import type { Field, GroupField } from 'payload'
import { deepMerge } from '@/utilities/deepMerge'

export interface NgsiDataSourceOptions {
  multipleEntities?: boolean
  additionalFields?: Field[]
  overrides?: Partial<GroupField>
}

export const ngsiDataSource = (options?: NgsiDataSourceOptions): Field => {
  // Returns GroupField with:
  // - entity (relationship to ngsi-entities)
  // - attributeSelection (all/include/exclude)
  // - selectedAttributes (array)
  // - refreshInterval (number)
}
```

**Cách test**:
- Import vào một block config tạm
- Chạy `pnpm generate:types`
- Vào Admin UI, tạo page mới, thêm block → xem fields hiển thị đúng không

---

### Task 1.4: Tạo Attribute Helpers

**File**: `src/blocks/NgsiBlocks/lib/attributeHelpers.ts`

**Mô tả**: Utilities để xử lý NGSI-LD attribute format.

```typescript
// NGSI-LD trả về format:
// { "temperature": { "type": "Property", "value": 25, "unitCode": "CEL" } }

// Extract value từ Property/GeoProperty/Relationship
export function extractValue(attr: unknown): unknown

// Filter attributes theo selection config
export function filterAttributes(
  entity: Record<string, unknown>,
  selection: 'all' | 'include' | 'exclude',
  selectedAttrs: string[]
): Record<string, unknown>

// Format value cho display (number → locale string, date → formatted, etc.)
export function formatAttributeValue(value: unknown, type?: string): string
```

**Cách test**:
```typescript
// Unit test
import { extractValue } from './attributeHelpers'

test('extracts Property value', () => {
  const attr = { type: 'Property', value: 25 }
  expect(extractValue(attr)).toBe(25)
})

test('extracts GeoProperty value', () => {
  const attr = { type: 'GeoProperty', value: { type: 'Point', coordinates: [1, 2] } }
  expect(extractValue(attr)).toEqual({ type: 'Point', coordinates: [1, 2] })
})
```

---

## Phase 2: NgsiCard Block

### Task 2.1: Block Config

**File**: `src/blocks/NgsiCard/config.ts`

```typescript
import type { Block } from 'payload'
import { ngsiDataSource } from '../NgsiBlocks/fields/ngsiDataSource'

export const NgsiCard: Block = {
  slug: 'ngsiCard',
  interfaceName: 'NgsiCardBlock',
  labels: { singular: 'NGSI Card', plural: 'NGSI Cards' },
  fields: [
    ngsiDataSource({ multipleEntities: false }),
    {
      name: 'displayOptions',
      type: 'group',
      fields: [
        { name: 'title', type: 'text', admin: { placeholder: 'Auto from entity type' } },
        { name: 'showEntityId', type: 'checkbox', defaultValue: true },
        { name: 'showLastUpdated', type: 'checkbox', defaultValue: true },
      ],
    },
  ],
}
```

---

### Task 2.2: Block Component

**File**: `src/blocks/NgsiCard/Component.tsx`

```typescript
import type { NgsiCardBlock } from '@/payload-types'
import { NgsiCardClient } from './Client'

// Server component - resolve entity config từ Payload
export const NgsiCard: React.FC<NgsiCardBlock> = async (props) => {
  // Resolve relationships để lấy brokerUrl, contextUrl, tenant...
  // Pass config xuống client component
  return <NgsiCardClient config={resolvedConfig} displayOptions={props.displayOptions} />
}
```

**File**: `src/blocks/NgsiCard/Client.tsx`

```typescript
'use client'

import { useNgsiData } from '../NgsiBlocks/hooks/useNgsiData'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react'

export const NgsiCardClient: React.FC<Props> = ({ config, displayOptions }) => {
  const { data, isLoading, error, refetch, lastUpdated } = useNgsiData({
    brokerUrl: config.brokerUrl,
    entityId: config.entityId,
    tenant: config.tenant,
    contextUrl: config.contextUrl,
    attrs: config.selectedAttributes,
    refreshInterval: config.refreshInterval,
  })

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>Failed to load: {error.message}</span>
          <button onClick={refetch}>Retry</button>
        </CardContent>
      </Card>
    )
  }

  // ... render card với data
}
```

---

### Task 2.3: Đăng Ký Block

**Files cần sửa**:

1. `src/collections/Pages/index.ts`:
```typescript
import { NgsiCard } from '@/blocks/NgsiCard/config'
// Thêm vào blocks array trong layout field
```

2. `src/blocks/RenderBlocks.tsx`:
```typescript
import { NgsiCard } from '@/blocks/NgsiCard/Component'
// Thêm: ngsiCard: NgsiCard
```

3. Chạy:
```bash
pnpm generate:types
```

---

## Phase 3: NgsiTable Block

### Task 3.1-3.3: Tương tự Phase 2

**Khác biệt chính**:
- `multipleEntities: true` trong field config
- Component render table với columns từ attributes
- Có thể thêm sorting, pagination (client-side)

---

## Phase 4: NgsiMap Block (Optional)

### Task 4.1: Install Dependencies

```bash
pnpm add leaflet react-leaflet
pnpm add -D @types/leaflet
```

### Task 4.2-4.3: Tương tự với Map-specific options

**Khác biệt**:
- Field `locationAttribute` để chỉ định GeoProperty
- Map options: zoom, center, marker style
- Dynamic import Leaflet (avoid SSR issues)

---

## Testing Guide

### Manual Testing Checklist

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Block hiển thị trong editor | Admin → Pages → Edit → Add Block | Thấy "NGSI Card" trong danh sách |
| Entity dropdown hoạt động | Click dropdown entity | Hiện danh sách entities từ Payload |
| Data load thành công | Save page, view frontend | Hiện data từ broker |
| Error handling | Tắt broker, reload page | Hiện error message với retry button |
| Auto refresh | Set interval = 5s | Data tự update mỗi 5s |
| Attribute filter | Chọn include + 2 attrs | Chỉ hiện 2 attrs đó |
| CORS error | (nếu broker chưa config) | Console hiện CORS error rõ ràng |

### Debug Commands

```bash
# Check TypeScript
pnpm typecheck

# Regenerate types
pnpm generate:types

# Test broker connection (dùng Fiware-Service - project đang dùng cách này)
curl -i http://localhost:1026/ngsi-ld/v1/entities \
  -H 'Accept: application/json' \
  -H 'Fiware-Service: Cantho' \
  -H 'Fiware-ServicePath: /'

# Hoặc dùng NGSILD-Tenant (chuẩn NGSI-LD spec)
curl -i http://localhost:1026/ngsi-ld/v1/entities \
  -H 'Accept: application/json' \
  -H 'NGSILD-Tenant: Cantho'

# Check browser console for:
# - Network requests (headers, response)
# - React errors
# - CORS errors
```

### Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `CORS policy blocked` | Broker không cho phép cross-origin | Thêm `ORIONLD_CORS_ALLOWED_ORIGIN=*` vào broker config |
| `404 Not Found` | Entity không tồn tại hoặc sai tenant | Check entityId, check Fiware-Service/NGSILD-Tenant header |
| `Block not found` | Chưa đăng ký trong RenderBlocks | Thêm mapping vào `blockComponents` |
| `Type error after adding block` | Chưa generate types | Chạy `pnpm generate:types` |
| `Hydration mismatch` | Server/Client render khác nhau | Dùng `useEffect` cho data fetching, không fetch ở server |
| `Cannot read property of undefined` | Entity relationship chưa populate | Dùng `depth: 2` khi query từ Payload |

---

## Definition of Done

### Cho Phase 1 (Foundation):

- [ ] `browser-client.ts` có thể fetch entity từ browser
- [ ] `useNgsiData` hook hoạt động với loading/error states
- [ ] `ngsiDataSource` factory tạo đúng fields
- [ ] `attributeHelpers` extract values đúng format
- [ ] Không có TypeScript errors

### Cho mỗi Block (Phase 2, 3, 4):

- [ ] Block xuất hiện trong Page editor
- [ ] Có thể chọn entity từ dropdown
- [ ] Data hiển thị đúng trên frontend
- [ ] Error state hiển thị khi broker unavailable
- [ ] Loading state hiển thị khi đang fetch
- [ ] Auto-refresh hoạt động (nếu configured)
- [ ] Attribute filtering hoạt động
- [ ] Không có hydration errors
- [ ] TypeScript pass

---

## File Structure Sau Khi Hoàn Thành

```
src/blocks/
├── NgsiBlocks/                      # Shared utilities
│   ├── fields/
│   │   └── ngsiDataSource.ts        # ✅ Task 1.3
│   ├── hooks/
│   │   └── useNgsiData.ts           # ✅ Task 1.2
│   └── lib/
│       └── attributeHelpers.ts      # ✅ Task 1.4
├── NgsiCard/                        # ✅ Phase 2
│   ├── config.ts
│   ├── Component.tsx
│   └── Client.tsx
├── NgsiTable/                       # ✅ Phase 3
│   ├── config.ts
│   ├── Component.tsx
│   └── Client.tsx
└── NgsiMap/                         # ✅ Phase 4 (optional)
    ├── config.ts
    ├── Component.tsx
    └── Client.tsx

src/lib/ngsi-ld/
├── index.ts
├── client.ts                        # Server-side (existing)
└── browser-client.ts                # ✅ Task 1.1 (NEW)
```

---

## Notes

### NGSI-LD @context - Hai Cách Truyền

NGSI-LD spec cho phép 2 cách truyền `@context`:

#### Cách 1: Link Header (khuyến nghị cho GET)

```bash
curl -X GET 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:Building:001' \
  -H 'Accept: application/json' \
  -H 'Link: <https://smart-data-models.github.io/dataModel.Building/context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -H 'Fiware-Service: Cantho'
```

Response sẽ là JSON thuần (không có @context trong body).

#### Cách 2: Embedded trong Body (cho POST/PATCH)

```bash
curl -X POST 'http://localhost:1026/ngsi-ld/v1/entities' \
  -H 'Content-Type: application/ld+json' \
  -H 'Fiware-Service: Cantho' \
  -d '{
    "@context": "https://smart-data-models.github.io/dataModel.Building/context.jsonld",
    "id": "urn:ngsi-ld:Building:001",
    "type": "Building",
    "name": { "type": "Property", "value": "Test Building" }
  }'
```

**Lưu ý**: Không trộn lẫn - nếu dùng `Content-Type: application/ld+json` thì KHÔNG dùng Link header.

### Multi-tenancy Headers

Orion-LD hỗ trợ cả 2 headers cho backward compatibility:

| Header | Spec | Ghi chú |
|--------|------|---------|
| `NGSILD-Tenant` | NGSI-LD 1.6+ | Chuẩn mới |
| `Fiware-Service` | NGSIv2 | Backward compatible |
| `Fiware-ServicePath` | NGSIv2 | Vẫn dùng được |

**Project này đang dùng `Fiware-Service`** - hoạt động tốt với Orion-LD.

### CORS Configuration cho Orion-LD

Nếu dùng docker-compose, thêm vào service orion:

```yaml
orion:
  image: quay.io/fiware/orion-ld
  environment:
    - ORIONLD_CORS_ALLOWED_ORIGIN=*
    - ORIONLD_CORS_MAX_AGE=86400
```

Hoặc nếu dùng Orion-LD command line:
```
-corsOrigin __ALL
```

### Alternative: Proxy qua Next.js API Route

Nếu không muốn config CORS trên broker, có thể tạo proxy:

```typescript
// src/app/api/ngsi-proxy/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const brokerUrl = searchParams.get('brokerUrl')
  const path = searchParams.get('path')
  
  // Forward request to broker
  const response = await fetch(`${brokerUrl}${path}`, {
    headers: {
      // Copy headers from request
    },
  })
  
  return Response.json(await response.json())
}
```

Nhưng cách này thêm latency và complexity, nên ưu tiên config CORS trực tiếp.
