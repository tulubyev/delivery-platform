import { FileText, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const docs = [
  { title: 'Договор оферты', desc: 'Условия оказания услуг доставки', file: 'oferta.pdf' },
  { title: 'Тарифы', desc: 'Актуальные тарифы на доставку', file: 'tariffs.pdf' },
  { title: 'Политика конфиденциальности', desc: 'Обработка персональных данных', file: 'privacy.pdf' },
  { title: 'Инструкция по созданию заказов', desc: 'Руководство по работе с порталом', file: 'guide.pdf' },
]

export function ClientDocsPage() {
  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Документы</h1>
        <p className="text-sm text-slate-500">Договоры, тарифы и инструкции</p>
      </div>

      <div className="space-y-3">
        {docs.map(d => (
          <Card key={d.file}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <FileText size={20} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-slate-900">{d.title}</p>
                <p className="text-sm text-slate-500">{d.desc}</p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download size={14} />PDF
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-blue-100 bg-blue-50">
        <CardContent className="p-4">
          <p className="text-sm text-blue-800 font-medium">Нужна помощь?</p>
          <p className="mt-1 text-sm text-blue-700">Свяжитесь с вашим менеджером или напишите на <a href="mailto:support@delivery.ru" className="underline">support@delivery.ru</a></p>
        </CardContent>
      </Card>
    </div>
  )
}
