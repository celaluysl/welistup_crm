# Welistup Agency OS — Faz 1 Mimarisi

## Klasör mimarisi

- `src/app/(auth)`: oturum ekranları
- `src/app/(app)`: korumalı uygulama route'ları
- `src/components/ui`: tekrar kullanılabilir temel UI bileşenleri
- `src/components/forms`: istemci formları
- `src/components/layout`: dashboard kabuğu
- `src/lib/actions`: server action ve mutation katmanı
- `src/lib/validation`: Zod şemaları
- `src/lib/supabase`: browser/server istemcileri ve session yenileme
- `supabase/migrations`: sıralı, tekrar üretilebilir veritabanı migration'ları

## Faz 1 şeması ve migration planı

Tek migration; enum ve extension'ları, kimlik/yetki tablolarını, müşteri–proje–hizmet çekirdeğini, index/trigger/fonksiyonları, RLS politikalarını ve başlangıç kataloğunu transaction-safe SQL ile oluşturur. Sonraki değişiklikler yeni migration dosyaları olarak eklenmelidir; uygulanmış migration düzenlenmemelidir.

Fiyat, `project_services` üzerinde tutulmaz. Tarih aralığı çakışması PostgreSQL exclusion constraint ile engellenen `project_service_prices` kayıtlarında saklanır. Böylece eski dönem fiyatları korunur.

## Authentication

Supabase Auth e-posta/şifre kullanır. `auth.users` kaydı trigger ile `profiles` kaydını oluşturur. SSR istemcisi cookie tabanlı oturumu okur; `proxy.ts` token yeniler ve korumalı route'ları login'e yönlendirir. Service-role anahtarı uygulamada kullanılmaz.

## Rol, permission ve RLS

Roller configurable'dır; iş kuralları rol adına değil `permissions.key` değerlerine bağlıdır. RLS her Faz 1 tablosunda aktiftir. Proje erişimi, tüm proje yetkisi veya proje sahipliği/üyeliği üzerinden hesaplanır. Fiyatlar ayrıca `finance.read` gerektirir. UI gizleme sonradan menü deneyimini iyileştirebilir ancak güvenlik sınırı RLS'dir.

İlk Auth kullanıcısına migration sonundaki örnek SQL ile `super-admin` rolü verilmelidir.

## Reusable UI

Dashboard shell, sidebar, sticky header, page header, card, button, field ve form kalıpları hazırdır. Liste ekranları ortak loading/empty/error desenlerine taşınabilecek şekilde ayrılmıştır. Faz 1 devamında data-table bileşeni sorting, filtre, pagination ve column visibility ile eklenebilir.

## Implementation sırası

1. Supabase projesine migration uygula.
2. İlk Auth kullanıcısını oluştur ve `super-admin` rolüne yükselt.
3. Login ve RLS smoke testlerini çalıştır.
4. Müşteri CRUD ve arşivleme akışını doğrula.
5. Proje CRUD, sahip/üye atama akışını tamamla.
6. Proje hizmeti formu, ekip üyeleri ve fiyat değişikliği transaction'ını tamamla.
7. E2E yetki matrisi ve temel testleri ekle.
