import type { Block } from 'payload'
import { ngsiDataSource } from '../fields/ngsiDataSource'

export const NgsiCard: Block = {
  slug: 'ngsiCard',
  interfaceName: 'NgsiCardBlock',
  labels: {
    singular: 'NGSI Card',
    plural: 'NGSI Cards',
  },
  fields: [
    ngsiDataSource({
      showRefreshInterval: true,
      defaultRefreshInterval: 30,
    }),
    {
      name: 'displayOptions',
      type: 'group',
      label: 'Display Options',
      fields: [
        {
          name: 'title',
          type: 'text',
          admin: {
            description: 'Card title. Use {{entityId}} or {{entityType}} as placeholders.',
            placeholder: 'e.g., Weather Station {{entityId}}',
          },
        },
        {
          name: 'showEntityId',
          type: 'checkbox',
          defaultValue: true,
          label: 'Show Entity ID',
        },
        {
          name: 'showLastUpdated',
          type: 'checkbox',
          defaultValue: true,
          label: 'Show Last Updated Time',
        },
        {
          name: 'cardStyle',
          type: 'select',
          defaultValue: 'default',
          options: [
            { label: 'Default', value: 'default' },
            { label: 'Compact', value: 'compact' },
            { label: 'Detailed', value: 'detailed' },
          ],
        },
      ],
    },
  ],
}
