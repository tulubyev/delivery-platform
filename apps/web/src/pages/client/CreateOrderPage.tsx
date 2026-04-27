import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ChevronRight, MapPin, User, Package } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AddressForm { street: string; city: string; flat?: string; entrance?: string; floor?: string; comment?: string }
interface Warehouse { id: string; name: string; address: string }

const emptyAddress = (): AddressForm => ({ street: '', city: 'Москва' })

function AddressBlock({ title, icon: Icon, value, onChange }: {
  title: string; icon: React.ElementType
  value: AddressForm; onChange: (v: AddressForm) => void
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Icon size={15} className="text-blue-600" />{title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Улица, дом</Label>
          <Input className="mt-1" placeholder="ул. Пушкина, д. 10" value={value.street}
            onChange={e => onChange({ ...value, street: e.target.value })} />
        </div>
        <div>
          <Label>Город</Label>
          <Input className="mt-1" placeholder="Москва" value={value.city}
            onChange={e => onChange({ ...value, city: e.target.value })} />
        </div>
        <div>
          <Label>Квартира / офис</Label>
          <Input className="mt-1" placeholder="15" value={value.flat ?? ''}
            onChange={e => onChange({ ...value, flat: e.target.value })} />
        </div>
        <div>
          <Label>Подъезд</Label>
          <Input className="mt-1" placeholder="2" value={value.entrance ?? ''}
            onChange={e => onChange({ ...value, entrance: e.target.value })} />
        </div>
        <div>
          <Label>Этаж</Label>
          <Input className="mt-1" placeholder="5" value={value.floor ?? ''}
            onChange={e => onChange({ ...value, floor: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label>Комментарий курьеру</Label>
          <Input className="mt-1" placeholder="Домофон 1234" value={value.comment ?? ''}
            onChange={e => onChange({ ...value, comment: e.target.value })} />
        </div>
      </CardContent>
    </Card>
  )
}

export function CreateOrderPage() {
  const navigate = useNavigate()

  const [pickup,   setPickup]   = useState<AddressForm>(emptyAddress())
  const [delivery, setDelivery] = useState<AddressForm>(emptyAddress())
  const [recipient, setRecipient] = useState({ name: '', phone: '' })
  const [details, setDetails] = useState({ weight: '', declaredValue: '', notes: '', warehouseId: '', scheduledAt: '' })
  const [apiError, setApiError] = useState('')

  // Получаем clientId из профиля
  const { data: profile } = useQuery<{ clientId: string | null }>({
    queryKey: ['client-profile'],
    queryFn: async () => {
      const { data } = await api.get('/clients/me')
      return data.data
    },
  })

  const { data: warehouses } = useQuery<Warehouse[]>({
    queryKey: ['warehouses-select'],
    queryFn: async () => { const { data } = await api.get('/warehouses'); return data.data.items },
  })

  const create = useMutation({
    mutationFn: () => {
      if (!profile?.clientId) throw new Error('Профиль клиента не найден')
      return api.post('/orders', {
        clientId:        profile.clientId,
        pickupAddress:   pickup,
        deliveryAddress: delivery,
        recipientName:   recipient.name,
        recipientPhone:  recipient.phone,
        weight:          details.weight   ? parseFloat(details.weight)   : undefined,
        declaredValue:   details.declaredValue ? parseFloat(details.declaredValue) : undefined,
        notes:           details.notes   || undefined,
        warehouseId:     details.warehouseId || undefined,
        scheduledAt:     details.scheduledAt || undefined,
      })
    },
    onSuccess: (res) => navigate(`/client/orders/${res.data.data.id}`),
    onError: (e: unknown) => {
      setApiError((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Ошибка создания заказа')
    },
  })

  const isValid = pickup.street && delivery.street && recipient.name && /^\+7\d{10}$/.test(recipient.phone)

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Новый заказ</h1>
        <p className="text-sm text-slate-500">Заполните информацию о доставке</p>
      </div>

      {/* Pickup */}
      <AddressBlock title="Адрес забора" icon={MapPin} value={pickup} onChange={setPickup} />

      {/* Delivery */}
      <AddressBlock title="Адрес доставки" icon={MapPin} value={delivery} onChange={setDelivery} />

      {/* Recipient */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <User size={15} className="text-blue-600" />Получатель
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Имя</Label>
            <Input className="mt-1" placeholder="Иван Иванов" value={recipient.name}
              onChange={e => setRecipient(r => ({ ...r, name: e.target.value }))} />
          </div>
          <div>
            <Label>Телефон</Label>
            <Input className="mt-1" placeholder="+79991234567" value={recipient.phone}
              onChange={e => setRecipient(r => ({ ...r, phone: e.target.value }))} />
            {recipient.phone && !/^\+7\d{10}$/.test(recipient.phone) && (
              <p className="mt-1 text-xs text-red-500">Формат: +7XXXXXXXXXX</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Details */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Package size={15} className="text-blue-600" />Детали посылки
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Вес (кг)</Label>
            <Input type="number" className="mt-1" placeholder="1.5" min={0.1} step={0.1}
              value={details.weight} onChange={e => setDetails(d => ({ ...d, weight: e.target.value }))} />
          </div>
          <div>
            <Label>Объявленная стоимость (₽)</Label>
            <Input type="number" className="mt-1" placeholder="5000" min={0}
              value={details.declaredValue} onChange={e => setDetails(d => ({ ...d, declaredValue: e.target.value }))} />
          </div>
          <div>
            <Label>Склад отправки</Label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={details.warehouseId} onChange={e => setDetails(d => ({ ...d, warehouseId: e.target.value }))}>
              <option value="">Без склада</option>
              {warehouses?.map(w => <option key={w.id} value={w.id}>{w.name} — {w.address}</option>)}
            </select>
          </div>
          <div>
            <Label>Запланировать на</Label>
            <Input type="datetime-local" className="mt-1"
              value={details.scheduledAt} onChange={e => setDetails(d => ({ ...d, scheduledAt: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <Label>Примечание</Label>
            <Input className="mt-1" placeholder="Хрупкий груз, не переворачивать"
              value={details.notes} onChange={e => setDetails(d => ({ ...d, notes: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      {apiError && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{apiError}</p>}

      <div className="flex gap-3 pb-6">
        <Button variant="outline" onClick={() => navigate(-1)}>Отмена</Button>
        <Button onClick={() => create.mutate()} disabled={!isValid || create.isPending} className="gap-2">
          {create.isPending ? 'Создаём...' : 'Создать заказ'}
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  )
}
