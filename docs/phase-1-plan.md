# iApteca — план первого этапа

> Уточнение после очистки 20.11.2026: таблицы ниже сохраняют исходный аудит 08.11 и не являются текущим перечнем готовности. Промокоды исключены из проекта; прежние указания сохранять их отменены. Выдвижная корзина удалена как неиспользуемая: актуальная реализация — `src/app/cart/page.tsx`, `src/components/CartPage.tsx` и существующий `cartStore`. Актуальная архитектура описана в [architecture.md](architecture.md).

> Актуализация типографики: в Screens, UI-Kit и приложении теперь используется **Manrope 400/500/600/700**. Замена прежнего Plus Jakarta Sans согласована дизайнером. Подключён полный локальный файл с украинскими символами; источник, лицензия и проверка описаны в [typography.md](typography.md). Упоминания Geist и Plus Jakarta Sans в исходном анализе ниже отражают состояние на момент первого аудита; прежние рекомендации по подключению этих шрифтов больше не применяются.

Дата подготовки: 2026-11-08.

## Цель и границы

Первый этап подготавливает основу дальнейшей реализации desktop-макетов Screens: фиксирует состояние CSS/токенов, сопоставление компонентов с UI-Kit и предлагаемую структуру маршрутов. На этом этапе изменены только два аналитических документа. Исходные CSS, маршруты, компоненты, модели и API не изменялись.

Мобильные макеты будут учтены после подготовки соответствующих экранов в Figma. Проверка рецепта и выбор аптеки остаются демонстрационными состояниями. MongoDB/API проекта сохраняются и переиспользуются.

## 1. Анализ текущих CSS и токенов

### Что сейчас в проекте

Файл src/app/globals.css использует Tailwind CSS v4, директиву @theme и семантические CSS-переменные. Набор похож на нейтральную тему shadcn:

- --background — белый; --foreground и --primary — нейтральные значения oklch.
- --secondary, --muted, --accent — нейтральный светлый тон; --border/--input — серо-нейтральная рамка.
- --radius — 0.625rem (10 px); производные radius-sm/md/lg/xl/2xl/3xl/4xl описаны в @theme.
- Есть .dark-тема. В Figma для текущей задачи источником служат светлые desktop-макеты; существующий dark theme не удалять без отдельного решения.
- Базовые правила задают фон/текст и antialiasing; стили компонентов в основном задаются Tailwind utility-классами.
- --font-sans в layout назначен переменной Geist; src/app/layout.tsx импортирует Geist и Geist Mono, subset только latin, а HTML имеет lang=uk.

### Что задаёт UI-Kit

Полученные Figma variables и foundation frames:

| Роль | Значение Figma |
|---|---|
| Primary / hover / active | #0056D2 / #0048B4 / #003B93 |
| Background / surface | #F4F7F9 / #FFFFFF |
| Border | #D7E2EE |
| Text / heading / body / secondary | #1C1C1C / #102541 / #334155 / #546B8F |
| Success / surface / text | #10B981 / #E8F8F1 / #047857 |
| Warning / surface / text | #F59E0B / #FFF5DF / #92400E |
| Error / surface / text | #EF4444 / #FEF0EF / #B91C1C |
| Font family | Plus Jakarta Sans |
| Примеры типографики | Display 49/700; H1 32/700; H2 24/600; H3 20/600; Body 16/500; button 16/600 |
| Desktop геометрия | кадры 1440 px; Home content 1240 px с отступом 100 px; Header 70 px; Footer instance 236 px |

### Вывод сравнения

Сейчас кодовая тема не совпадает с визуальными ролями UI-Kit: primary в коде нейтральный вместо синего; фон в коде белый вместо #F4F7F9; нейтральный border отличается от синего-серого #D7E2EE; шрифт Geist отличается от Plus Jakarta Sans. UI-Kit также задаёт семантические success/warning/error, category, hover/active/focus цвета, которых нет как полного набора общих переменных в globals.css.

В Figma не удалось подтвердить полную непрерывную spacing scale: variable lookup по Foundations вернул именованные цветовые и текстовые значения и только spacing/0. Значит, промежуточные отступы следует сначала сверить по геометрии реальных компонентов, не выдумывать токены.

### Предлагаемый будущий шаг и файлы

| Предлагаемое изменение после согласования | Существующие файлы | Зачем |
|---|---|---|
| Сопоставить семантические переменные --primary, --background, --foreground, --border, --muted, --ring и добавить недостающие success/warning/category роли | src/app/globals.css | Дать переиспользуемые цвета вместо разрозненных литералов в utility-классах и приблизить все экраны к UI-Kit |
| Подключить Plus Jakarta Sans и проверить украинские глифы/начертания | src/app/layout.tsx, возможно src/app/globals.css | Figma использует Plus Jakarta Sans; сейчас layout подставляет Geist/Geist Mono и latin subset |
| Проверить радиусы и focus ring по реальным компонентам UI-Kit, обновлять только отличающиеся значения | src/app/globals.css, точечно src/components/ui/button.tsx и другие UI primitives | Сохранить текущие компоненты, приводя конкретные размеры/состояния к макету |
| Сохранить поддержку текущей .dark-темы до отдельного решения | src/app/globals.css | Не удалять существующее поведение, которого нет в текущем scope Figma |

На этом этапе это предложения, не изменения.

## 2. Анализ компонентов и переиспользование

### Уже существующие и пригодные к переиспользованию

| Файлы | Текущее назначение | Как использовать |
|---|---|---|
| src/components/ui/button.tsx | Button с CVA variants и размерами | Базовые кнопки Figma; сопоставить варианты и состояния, не переписывать |
| src/components/ui/input.tsx, label.tsx | Поле и подпись | Поиск, checkout и формы; расширить только недостающими состояниями/связями |
| src/components/ui/select.tsx, checkbox.tsx | Radix Select/Checkbox обёртки | Категория, сортировка, фильтры; стили сопоставить с UI-Kit |
| src/components/ui/card.tsx, badge.tsx | Карточка и Badge | Основа карточек товара/набора и статусов наличия/Rx |
| src/components/ui/sheet.tsx, dialog.tsx, dropdown-menu.tsx | Доступные primitive-обёртки | Cart drawer, меню аккаунта и будущие диалоги при совпадении со сценарием |
| src/components/ui/table.tsx, tabs.tsx, skeleton.tsx, sonner.tsx | Таблица, tabs, loading, toast | Переиспользовать при сравнении, переключениях и уведомлениях |
| src/components/Header.tsx | Текущие бренд, корзина, профиль/admin | Сохранить auth/cart поведение и доработать под Figma Header |
| src/components/ProductCard.tsx | Товар, цена, наличие, add-to-cart | Сохранить добавление в корзину и расширить вариантом Rx/compare/favorite |
| src/components/SearchAndFilters.tsx | URL-backed поиск, категория, sort, inStock | Сохранить как основу каталога и развить фильтры/подсказки |
| src/components/Pagination.tsx | URL pagination | Переиспользовать, визуально адаптировать при необходимости |
| src/components/CartDrawer.tsx | Выдвижная корзина, количества, удаление | Сохранить как быстрый доступ и использовать lib/store/cartStore.ts для полной страницы |
| src/lib/store/cartStore.ts | Zustand persistent cart, add/remove/quantity/clear | Не переписывать; расширять только после согласования формата рецептов/наборов |

### Новые или существенно расширяемые компоненты после согласования

| Компонент | Предполагаемое расположение | Основание |
|---|---|---|
| Footer | src/components/Footer.tsx (новый) | В layout.tsx Figma использует общий Desktop Footer, текущего Footer нет |
| Homepage sections: Hero, benefits, featured categories/kits | src/components/home/* (новые) | Главная Figma отличается от текущего каталога |
| SearchField, SuggestionsPanel, PopularQueryChip | src/components/catalog/* (новые) | В коде нет recent/symptom/typo suggestion states |
| PriceSlider, AppliedFilterChip, FilterSidebar | src/components/catalog/* (новые) | Текущая фильтрация ограничена категориями, sort и inStock |
| ProductGallery, ProductAccordion, CompareButton | src/components/product/* (новые/доработка ProductCard) | В детали сейчас одно фото, нет Figma accordions/compare |
| CompareTable | src/components/compare/* (новый) | В UI нет сравнения товаров |
| CartPage/CartItem/QuantityStepper | src/components/cart/* (новые; QuantityStepper можно вынести из CartDrawer) | Нужна страница корзины; логику cartStore сохранить |
| PrescriptionUpload/PrescriptionStatus/PrescriptionSlots | src/components/prescription/* (новые) | Полный single и multi Rx flow выполняется демонстрационно |
| KitCard/KitContents/KitRecommendations | src/components/kits/* (новые) | Нет маршрута и модели готовых аптечек |
| CheckoutForm/ReceivingMethod/PharmacyPickerDemo/PaymentChoice | src/components/checkout/* (новые) | Существующий checkout не содержит формы получения, карты-демо и выбора оплаты |
| OrderResult | src/components/orders/* (новый) | Единое отображение success/error, Rx/kit/3-of-5/all-5 states без дублирования страниц |
| Form field error/help | возможно src/components/ui/input.tsx и общая форма | Нужны подписанные поля и ошибки validation state; менять Input только если wrapper не покрывает Figma |

Названия директорий — предложение для небольшого учебного проекта, не требование переписывать текущую структуру.

## 3. Предлагаемая структура маршрутов

App Router уже используется через src/app. Предлагаемая карта маршрутов сохраняет существующие страницы:

| Маршрут | Статус сейчас | Назначение | Файлы, которые могут потребоваться |
|---|---|---|---|
| / | Есть, но отображает каталог | Главная Screens | src/app/page.tsx; новые src/components/home/* |
| /catalog | Нет | Каталог, поиск/фильтры/сортировка и их состояния | новый src/app/catalog/page.tsx; перенос/переиспользование логики src/app/page.tsx; SearchAndFilters.tsx, ProductCard.tsx, Pagination.tsx |
| /product/[id] | Есть | Карточка товара, gallery, accordions | src/app/product/[id]/page.tsx; новые product components |
| /compare?products=… | Нет | Парное/табличное сравнение | новый src/app/compare/page.tsx; новый CompareTable |
| /cart | Нет | Пустая/полная корзина, количества, Rx flow | новый src/app/cart/page.tsx; cartStore.ts, CartDrawer.tsx, новые cart/prescription components |
| /kits | Нет | Каталог аптечек | новый src/app/kits/page.tsx |
| /kits/[id] | Нет | Состав/рекомендации одной аптечки; в UI состояния для количества наборов | новый src/app/kits/[id]/page.tsx |
| /checkout | Есть | Форма, validation, получение, pharmacy demo, payment, Rx approval | src/app/checkout/page.tsx и новые checkout components |
| /order/result?status=… | Нет | Success/error и варианты состава заказа | новый src/app/order/result/page.tsx, checkout/page.tsx для перехода после API success |
| /login, /profile, /reset-password, /admin/* | Есть | Существующая авторизация, история заказов и административная функция | Сохранить текущие страницы/функции без удаления |

Отдельные status states (ошибка формы, подсказки, empty cart, Rx pending/approved) по умолчанию остаются state внутри маршрута. Query params для поиска/фильтров сохраняют возможность делиться ссылкой на каталог. Путь /catalog требует отдельного переноса логики из нынешнего src/app/page.tsx так, чтобы текущий функционал не потерялся.

## 4. Данные и API — только подготовительные замечания

Существуют src/lib/types.ts, src/lib/models.ts, src/lib/db.ts, API medications/categories/orders, корзина и профиль. Текущие Medication поля: name, description, price, stock, category, manufacturer, image. В текущих типах не подтверждены признак Rx и сущность Kit.

После согласования экранов возможны небольшие расширения:
- Medication: optional requiresPrescription (если этого признака нет в исходных данных) и дополнительные поля продукта только по конкретным Figma требованиям; вероятные файлы src/lib/types.ts, src/lib/models.ts, medication API/admin формы.
- Kit: Figma описывает готовую упаковку из трех позиций, но cart/receipt показывают два обычных товара и другую сумму. Минимальный кандидат — SKU в текущем Medication каталоге с optional kind=KIT и kitContents; OrderItem.medication и текущая резервация stock остаются совместимыми, если набор продается как готовая упаковка. Отдельные KitModel + typed OrderItem — вариант при самостоятельном управлении составом/остатком; динамическое разложение на Medication подходит только если все элементы набора являются продаваемыми Medication.
- Rx: хранить в cart/session state только serializable file label/fixture, привязку к Medication, статус и demo outcome; не сохранять File binary. Для одного товара нужен один Rx state, для Multi-Rx — отдельное состояние по каждому из двух товаров. Перед clearCart перенести receipt snapshot в session result state; Order schema расширять только если эти данные нужны в истории после сессии.
- Pharmacy: выбор/список/маркер карты можно демо-данными и локальным состоянием; не подключать внешнюю карту/API.
- Изображения: сейчас у Medication есть optional image; подобрать и загрузить assets по макетам до заполнения/обновления каталожных данных.

## 5. Порядок первого этапа и критерии готовности

1. Зафиксировать таблицу соответствия семантических CSS variables и Figma tokens; отдельно отметить неподтверждённые spacing values.
2. Согласовать шрифт и украинский glyph coverage до замены Geist.
3. Сопоставить общие UI primitives: Button, Input/Label, Select, Checkbox, Card, Badge, Sheet/Dialog/Dropdown, Table, toast.
4. Зафиксировать список новых общих компонентов и экранных компонентов, не дублируя component states как страницы.
5. Утвердить маршрутную схему и переход catalog logic от / к /catalog с сохранением существующего маршрута/поведения.
6. Согласовать гостевую политику checkout, детерминированный выбор Multi-Rx demo outcome и модель Kit до подключения сценариев к API.
7. После отдельного подтверждения применять только согласованные небольшие изменения в токенах/общей оболочке. Реализацию экранов планировать отдельными этапами.

Этап 1 считается подготовленным, когда таблица токенов, component reuse list, маршрутная схема и список затрагиваемых файлов просмотрены и согласованы. Код на этом этапе менять не нужно.

## 6. Файлы с будущими возможными изменениями и причины

| Файл | Причина возможного изменения |
|---|---|
| src/app/globals.css | Семантические переменные, шрифтные utility aliases, радиусы, focus/semantic colors |
| src/app/layout.tsx | Plus Jakarta Sans, общий Footer, сохранение украинского lang, общая оболочка |
| src/app/page.tsx | Новая главная либо перенос нынешней каталожной логики; сохранить каталог при выделении /catalog |
| src/app/catalog/page.tsx (новый) | Отдельная страница каталога с текущим API-запросом и новыми состояниями |
| src/components/Header.tsx | Сопоставить header с Figma, сохранив cart/auth/admin |
| src/components/Footer.tsx (новый) | Общий footer desktop из UI-Kit |
| src/components/ProductCard.tsx | Доработать картинку, статусы, Rx, сравнение/избранное, не ломая add-to-cart |
| src/components/SearchAndFilters.tsx | Расширить URL-backed фильтры, сортировку, Search suggestions |
| src/components/Pagination.tsx | Возможно только визуальное сопоставление; текущая URL логика сохраняется |
| src/components/CartDrawer.tsx | Сохранить header drawer; возможно переиспользовать вынесенную строку/stepper |
| src/components/ui/button.tsx, input.tsx, label.tsx, select.tsx, checkbox.tsx, badge.tsx | Точечная подгонка размеров, цветов, состояний UI-Kit |
| src/components/ui/card.tsx, sheet.tsx, dialog.tsx, dropdown-menu.tsx, table.tsx | Только при расхождении конкретного Figma компонента с примитивом |
| src/app/product/[id]/page.tsx | Галерея, свойства, accordions, actions |
| src/app/checkout/page.tsx | Поля, ошибки, pharmacy demo, payment, Rx flow, результат API |
| src/app/cart/page.tsx (новый) | Полная страница корзины на текущем Zustand store |
| src/app/compare/page.tsx (новый) | Таблица пары/сравнения |
| src/app/kits/page.tsx, src/app/kits/[id]/page.tsx (новые) | Каталог и состав аптечек |
| src/app/order/result/page.tsx (новый) | Success/error и варианты результатов |
| src/lib/store/cartStore.ts | Только если выбранное представление Kit/Rx не выражается текущим cart state; текущие add/remove/quantity/stock/persist сохранить |
| src/lib/types.ts, src/lib/models.ts, src/lib/db.ts | Возможные типы/модели Kit или Rx-флаг; менять после подтверждения data requirements |
| src/app/api/medications/*, src/app/api/orders/* (точечно) | Использовать существующие API; расширить совместимо лишь при необходимости новых полей |
| src/app/admin/medications/page.tsx | Если новый Rx-флаг или product fields должны редактироваться администратором |
| src/app/profile/page.tsx | Не переписывать; только при необходимости отобразить дополнительные сохранённые order fields |

Все перечисленные файлы — потенциальные будущие точки изменения, не перечень выполненных правок.

'

## Дополнительная техническая проверка для согласования

### Multi-Rx ветки

Кадры 1611:8942 и 1611:9061 имеют одинаковый заголовок, но различаются текстом и переходом:

- 1611:8942: «Після підтвердження обох позицій можна продовжити оформлення.» → AFTER_TIMEOUT на 1611:9544 «Рецепти підтверджено».
- 1611:9061: «Після перевірки тут з’явиться результат для кожного препарату.» → AFTER_TIMEOUT на 1611:9180 «Потрібне нове фото» → 1611:9302 «Нове фото прикріплено» → 1611:9425 «Новий рецепт на перевірці» → timeout → 1611:9544.

Оба кадра содержат карточки Амоксициліну 500 мг №10 и Азитроміцину-Дарниця 500 мг №3 с отдельными вложенными файлами. Для защиты обе ветки должны запускаться предсказуемо. Рекомендуется сохранить demo outcome отдельно и выбирать его явно в демонстрационном preset/query; основной экран не обязан показывать новый контрол. В обоих случаях использовать фиксированный Prototype-like timeout; случайный выбор результата исключить.

### Checkout: расхождение Figma и текущей auth-политики

В Figma Checkout содержит поля имени/фамилии, телефона, email, способ получения и validation states. Prototype переходит из корзины прямо к checkout, далее из заполненной формы к успешному результату; отдельный login step не показан. Это поддерживает гостевой UX, хотя слово «гость» в макете отсутствует.

Кодовая цепочка: checkout/page.tsx handleOrder перенаправляет на /login без user; POST /api/orders также отвечает 401 без getAuthUser; OrderModel требует user. Возможные решения — (а) guest-aware POST со свободными contact fields и сохранением user для вошедших; (б) добавить auth gate в Figma/UX; (в) оставить гостевой визуальный demo без записи заказа. Вариант (а) ближе к имеющемуся Figma flow и сохраняет старую ветку для вошедших, но требует решения по доступу к guest order receipt. Не применять до согласования.

### Kit и обратная совместимость Order

Figma detail frame 1690:8542 называет аптечку готовым демонстрационным набором первой помощи из 3 позиций: пластыри, бинт и антисептические салфетки; цена карточки набора — 249 грн. Однако frames 1690:8858/1742:8741 для cart показывают две строки обычных товаров и 224 грн, а 1690:9233/1742:9127 — те же две строки и ту же сумму. Версия «2 набори» не показывает удвоенные количества/сумму в доступном metadata. Дизайн этих частей нужно согласовать.

Текущая совместимость: Medication имеет цену и stock; OrderItem хранит medication id, quantity, price; API уменьшает stock соответствующего Medication. Рекомендуемая минимальная модель при подтверждении готовой упаковки — catalog SKU в текущей коллекции Medication с необязательным kind=KIT и kitContents, где stock означает количество упаковок набора. Старые документы и API payload с medication id продолжают означать обычные товары. Если наборы должны иметь независимый состав/остатки, отдельный Kit + discriminated OrderItem яснее, но потребует ветки проверки/резервации в API; при старых OrderItem без discriminator продолжать трактовать запись как Medication. Раскладывать набор на medication lines имеет смысл только если состав действительно состоит из Medication, чего макет аптечки сейчас не подтверждает.

### Состояние рецепта и result snapshot

Текущий cartStore использует Zustand persist с ключом iapteca-cart и хранит сериализуемые позиции; updateQuantity(q<=0) удаляет позицию. С Rx можно переносить между маршрутами только метаданные: medication/cart-line id, имя demo fixture, slot, статус required/attached/reviewing/approved/needs-new-photo, номер проверки и demo outcome. Для Multi-Rx хранить 2 отдельных объекта, привязанных каждый к своему Medication. Бинарные File и object URL не сохранять в localStorage/MongoDB.

После успешного POST checkout сейчас очищает корзину до перехода на /profile. Для будущего экрана результата сначала сохранить полученный order/receipt snapshot в памяти или sessionStorage, затем очищать cart; расширять Order schema Rx-полями следует только при необходимости повторного просмотра в истории.

### Cart quantity 0 и 3/5 result

updateQuantity в cartStore при q<=0 вызывает removeItem, который удаляет позицию из массива. Это совпадает с Figma quantity frames 1649:6292, 6634, 6976, 7327, 7678, 8020 и 8362: ноль — отсутствие строки товара; не нужно хранить quantity=0.

Order result frames 1547:3970 и 1568:4020 — компактный список, а не частичная выдача: первый показывает 3 из 5 и «Показати ще 2», второй показывает все 5 и «Згорнути». Prototype click переключает эти состояния в обе стороны. Результат можно построить из обычных order.items: slice 0..3 для свернутого отображения и полный список при expanded=true. Дополнительный fulfillment/partial-stock data model для этих кадров не нужен.

### Решения, ожидающие команды

- Выбрать guest checkout или обязательный вход до отправки.
- Подтвердить, считается ли аптечка готовым SKU или составляется из товарных строк; сверить указанные в Figma цены/позиции/количества.
- Утвердить способ воспроизведения Rx demo outcome (preset/query или другой).
- Не требуется отдельное решение по количеству 0 и смыслу 3/5: поведение установлено как удаление cart row и раскрытие списка соответственно.
