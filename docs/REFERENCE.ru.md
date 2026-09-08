# Справочник

**Кому это?** Тому, кто спрашивает, что проверка ловит, что печатает и зачем вообще
существует.
**Когда читать?** При выборе проверки или когда одна из них только что сработала. Как
включить — [таблица в гайде](GUIDE.ru.md#turn-on); все ключи — [конфигурация](CONFIGURATION.ru.md).

---

По разделу на ситуацию, с тем выводом, который инструмент печатает на самом деле, — ничего
нарисованного. В каждом названа проверка, которую надо включить, и откуда взялось правило;
рассуждение о модели целиком — в [стандарте](STANDARD.ru.md).

| Проверка | Падает, когда |
|---|---|
| `proof` | файл, тест или команда из задокументированного утверждения исчезли |
| `tracks` | трек ссылается на удалённый хендофф |
| `tasks` | отмеченная галочка не называет проверку |
| `queue` | пункт, объявленный проходящим, падает при перезапуске |
| `locked` | коммит агента тронул файлы, которые его оценивают |
| `cold-start` | свежий клон не может установиться и проверить себя |
| `clean-exit` | сессия оставила мусор или ничего не записала |
| `instructions` | файл инструкций вышел за лимит строк |
| `release` | манифест, changelog и теги расходятся |

## 1. README описывает то, чего не существует

*Откуда: Лекция 03 — репозиторий как источник правды. Не из курса: сам синтаксис маркеров, он вырос из продакшн-репозиториев.*

*Унаследованный репозиторий или агент, задокументировавший свои намерения.*

Вы один раз пишете утверждение и прикрепляете к нему доказательство:

```markdown
Суммы округляются по валюте, а не по строке.   <!-- proof: docs/<файл>.md -->
Проверить самому: `make verify`.               <!-- proof: make <цель> -->
```

(Настоящий маркер называет настоящий путь; угловые скобки выше нужны только для того, чтобы
примеры на этой странице не проверялись как утверждения.) Удалите документ или переименуйте
цель — и сборка об этом скажет:

```
FAIL  proof markers
  README.md:31  docs/ARCHITECTURE.md
      no such file
  README.md:32  make verify
      no make command named "verify"
```

**Включить:** `docs`. Документы, которым нельзя расходиться с кодом, добавьте в
`docs.mustCarryProof` — они обязаны нести хотя бы один маркер, чтобы переписывание не могло
незаметно выбросить доказательство вместе с утверждением.
<!-- proof: src/proof.ts:verifyProofs -->

## 2. «У меня работает» — и только там

*Откуда: Лекции 03 и 10 — репозиторий как источник правды и реальный прогон как доказательство.*

*Онбординг, новая сессия агента, чистый раннер CI.*

`cold-start` клонирует ваш репозиторий в пустой каталог и запускает те команды, которые ваша
же документация даёт новичку. Без кэшей, без перенесённого окружения, без того, что есть
только на машине, где это собиралось.

```
FAIL  cold start
  the clone ran: npm ci && npm test
    npm ci failed: package-lock.json is not committed
```

**Включить:** `coldStart`, перечислив `requiredFiles`, `entryDocs` и `commands`, которые
выполняет новичок. <!-- proof: src/coldstart.ts:coldStartProblems -->

## 3. Фича, которая занимает четыре сессии

*Откуда: Лекция 05 — непрерывность между сессиями. Форма хендоффа не из курса.*

*Контекст умирает в конце каждой сессии; следующая выводит его заново или заново решает уже
решённый вопрос.*

Живая работа лежит в `specs/TRACKS.md` — по строке на трек, каждая указывает на `handoff.md`,
где написано, что загрузить, чего *не* загружать, где работа остановилась и какой первый шаг.
Следующая сессия получает это на старте, а не перечитывает репозиторий:

```
$ harnessimo brief
== specs/TRACKS.md (live work tracks — load a track's handoff first) ==
- Checkout totals — [handoff](specs/0007-checkout/handoff.md) — active, next: T3 currency rounding
- Hosted deploy — none — blocked (on an API token)
```

Индекс проверяется машиной, потому что handoff, который врёт, хуже, чем его отсутствие: трек
без статуса или ссылка на удалённый handoff роняют гейт.

**Включить:** `tracks`. <!-- proof: src/tracks.ts:checkHandoffRefs -->

## 4. «Готово», которое перестало быть правдой

*Откуда: Лекции 08 и 09 — списки фич как примитивы и преждевременное объявление победы.*

*Задача действительно была закончена в марте. В мае её сломало что-то постороннее, а на доске
по-прежнему «готово».*

У каждого элемента очереди есть своя команда проверки. `passing` пишет только инструмент и
только после того, как эта команда вернула 0, — а `--reverify` перезапускает их все в CI:

```
FAIL  queue
  "checkout-totals" claims passing but its verification fails now
    command: npm test -- checkout
    fix:  fix the regression, or the claim was never true
```

Поправить `state` руками — не короткий путь, а ровно то, что эта проверка и ловит.

**Включить:** `queue`. <!-- proof: src/queue.ts:checkQueue -->

## 5. Агент, который правит собственный экзамен

*Откуда: Не из курса. Locked-поверхности выросли из продакшена, где агент правил скрипт, который его же оценивал.*

*Самый быстрый способ сделать красную сборку зелёной — поменять определение зелёного.*

Назовите поверхности, которые задают успех: workflow'ы CI, файл ограничений, пороги эвалов.
Коммит с трейлером агента, который их трогает, роняет сборку:

```
FAIL  locked surfaces
  a1b2c3d  Co-Authored-By: Claude  touched .github/workflows/ci.yml
    fix:  a human makes this change, or the baseline records why it moved
```

Это детекция дрейфа в CI, а не песочница: она ловит честный случай, который и является
частым.

**Включить:** `locked`, с `paths`, `baseline` и вашим `agentTrailer`.
<!-- proof: src/locked.ts:lockedViolations -->

## 6. Долгий прогон без присмотра

*Откуда: Лекция 12 — чистое состояние на выходе из сессии.*

*Вы его запускаете и идёте спать.*

`clean-exit` читает то, что сессия на самом деле изменила, и не пропускает два способа плохо
закончить, не упав: мусор, оставленный в коде (`TODO`, `debugger`, `.only(` — маркеры
выбираете вы), и файл прогресса, который остался нетронутым, пока вокруг поменялись сотни
строк.

```
FAIL  clean exit
  src/checkout/totals.ts:88        debugger
  .harness/4-state/PROGRESS.md     unchanged while 412 lines of code moved
    fix:  write down where this got to, or the next session starts blind
```

**Включить:** `cleanExit`. Порог `progressThreshold` не даёт правке в одну строку уронить
проверку. <!-- proof: src/cleanexit.ts:progressProblems -->

## 7. «А что этот репозиторий вообще гарантирует?»

*Откуда: Лекция 04 — один огромный файл инструкций не работает; честность `doctor` — собственное правило этого проекта.*

*Новый контрибьютор, ревью или вы сами через полгода.*

```
$ harnessimo doctor
  enforced      proof markers    docs claims resolve to real files, tests and commands
  enforced      work tracks      the track index resolves and every track carries a status
  not enforced  queue            no queue section in harnessimo.config.json
```

Проверка, которую вы не настроили, выводится как *not enforced* — там же и тем же весом.
Харнес, преувеличивающий собственное покрытие, — это тот самый провал, ради предотвращения
которого он существует.
<!-- proof: test/cli.test.ts#doctor reports what is enforced and what is not, without overstating -->

## 8. Версия означает разное в разных местах

*Откуда: Не из курса и ниоткуда больше: этот репозиторий опубликовал три версии дальше собственного последнего тега.*

*Бейдж говорит одно, реестр отдаёт другое, и оба правы относительно себя.*

Это не гипотетический случай: пока писался этот инструмент, три версии уехали в npm через
ручной запуск workflow, а собственные теги репозитория остановились двумя релизами раньше.
Никто не заметил, потому что никто не проверял самое дублируемое утверждение, какое делает
проект.

```
FAIL  release
  CHANGELOG.md:1  v0.4.3
      0.4.3 is described as released and has no v0.4.3 tag
    why:  a version published outside the release flow leaves the repository behind
    fix:  cut the release, or remove the entry if it never shipped
```

**Включить:** `release`, указав манифест, changelog и префикс тега. Он читает версию из
манифеста, записи из changelog и теги из git; версия, которую никто не записал, запись не на
верхней позиции и выпущенная версия без тега — всё это падает.
<!-- proof: src/release.ts:releaseProblems -->

---

## 9. Сессия дорогая, и никто не считает

*Долгие прогоны агента, где большая часть бюджета уходит до того, как что-то закончено.*

Самая крупная устранимая статья расходов в долгой сессии — один и тот же файл, прочитанный
дважды. Второе чтение стоит всей своей длины снова и не сообщает модели ничего, чего у неё
уже нет, — и об этом никто не отчитывается, поэтому никто это и не чинит.

```
$ harnessimo budget
harnessimo budget — this session (estimated at 4 bytes per token)

  read          38 file(s), ~184k tokens
  re-read        9 file(s), ~41k tokens — 22% of everything read
  largest     src/pipeline.ts, read 3×, ~7k each

  fix:  a re-read is a session that lost its place. `harnessimo guard read <path>`
        refuses the second read of a file that has not changed.
```

Подключённый как хук на использование инструмента, guard отвечает до того, как чтение
произойдёт: первый раз — можно, второй без изменений — нет, изменился — снова можно.
Диапазон не равен целому файлу, а `--override` всегда побеждает — и попадает в счёт, чтобы
мешающее правило было видно в отчёте, а не в чьём-то раздражении.

**Включить:** `tokens`. Это **не** десятая проверка: девять отвечают на вопрос «закончено
ли», а эта срабатывает в момент работы. `doctor` показывает её отдельно именно поэтому, и
`check` её не запускает — гейт завершённости, зависящий от состояния сессии, был бы гейтом,
который никто не сможет воспроизвести.
<!-- proof: src/tokens.ts:decideRead -->

---

## Сессия целиком

```
$ harnessimo brief
== specs/TRACKS.md (live work tracks — load a track's handoff first) ==
- Checkout totals — [handoff](specs/0007-checkout/handoff.md) — active, next: T3 currency rounding

== work queue ==
active: checkout-totals — an order total matches the sum of its lines, in every currency
  verify with: harnessimo queue verify checkout-totals

== enforced here ==
proof, tracks, tasks, queue, coldStart, cleanExit

# ... агент работает ...

$ harnessimo queue verify checkout-totals
running: npm test -- checkout
  ✓ 12 tests passed
checkout-totals: passing — evidence recorded

$ git commit -m "feat(checkout): per-currency rounding (0007)"
harnessimo: proof markers ok · tracks ok · task gate ok · queue ok
[main 4f1a2b9] feat(checkout): per-currency rounding (0007)
```

Коммит прошёл, потому что прошли проверки, а не потому, что кто-то сказал, что готово.

---

Дальше: [что взято из OpenSpec, Spec Kit, BMAD и остальных](SDD.md) ·
[внедрение в существующий репозиторий](GUIDE.ru.md#adopting)
