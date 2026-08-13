# 个人卡路里 + 胰岛素追踪 Web App — 设计文档

## Context

市面卡路里追踪app(MyFitnessPal, Cronometer等)大多收费, 且冇为Type 1糖尿病用户设计嘅胰岛素记录功能。用户(T1D)想要一个免费、拍照AI自动分析食物营养(卡路里/碳水/蛋白质/脂肪), 同时可以简单记录每餐胰岛素剂量嘅个人工具。目标: 输入身体资料(年龄/体重/身高/目标)后, 系统按标准公式计算每日calorie/macros target; 之后每餐拍照, AI自动识别分析, 自动扣减remaining calories, 胰岛素只需手动填units+时间(唔做剂量建议, 避免医疗责任)。

## 技术架构

- **前端+后端**: Next.js (App Router), PWA (可加到手机主屏幕, 支持相机直接拍照input)
- **Hosting**: Netlify (免费tier, 用 `@netlify/plugin-nextjs` runtime, API routes行serverless function)
- **数据库+认证+相片存储**: Supabase 免费tier
  - Auth: email+密码登录(单一用户account, 保护公开host嘅健康data)
  - Postgres DB (500MB免费): profile, 每日目标, 餐记录, 胰岛素记录
  - Storage (1GB免费): 餐相片, 压缩后上传, 定期(6个月)自动清理
- **AI食物识别**: Google Gemini API (2.5 Flash, 免费tier, 250 requests/day/10RPM, 用户日均3次远低于上限), 经Next.js server-side API route调用(key唔暴露畀前端)
  - 用户已知悉free tier data会用作Google训练, 接受此取舍

## 数据模型 (Supabase Postgres)

- `profile`: age, weight_kg, height_cm, sex, activity_level, goal(lose/maintain/gain), target_weight_kg(nullable, goal=maintain时不需要), target_date(nullable)
- `daily_targets` (派生, 或每次profile变更时重算): calories, carbs_g, protein_g, fat_g — 用 **Mifflin-St Jeor** 公式算BMR, 乘活动系数得TDEE, 再按目标算calorie deficit/surplus, 拆算macros(碳水45-50%/蛋白质20-25%/脂肪25-30%, 可后续微调)

### 目标安全检查
用户设定`target_weight_kg` + `target_date`后:
1. 系统算出所需每周变化量 = (target_weight_kg − 当前weight_kg) / 剩余周数
2. 对比安全上限(业界通用标准: 每周最多减/增 **1kg 或 体重1%, 取较小值**)
3. 若超出安全线 → 提示"呢个速度唔安全(每周Xkg, 建议上限Ykg)", 自动算出建议方案(用安全速率倒推所需date, 或维持原date但显示较温和嘅deficit同预估实际达成date) → 用户可一键采用建议, 或勾选"我明白风险, 坚持原计划"手动强设(仍会喺dashboard持续显示风险提示)
4. 每日calorie target就系跟据(采纳后嘅)安全deficit/surplus计, 唔系直接按用户原始狠date硬砌
- `meal_logs`: timestamp, photo_url(nullable, 6个月后置null但保留数值), user_note(可选, 用户拍照前手动填嘅材料提示, 例如"low fat milk"/"light mayo"), calories, carbs_g, protein_g, fat_g, ai_raw_description(AI识别出嘅食物文字, 方便用户核对/手动修正)
- `insulin_logs`: timestamp, units, linked meal_log_id(nullable, 因为可能同一餐但分开记), note(可选, 例如"bolus"字眼纯文字, 唔做类型下拉限制以保持简单)

## 核心流程

1. **Onboarding**: 首次登入 → 填profile(年龄/体重/身高/性别/活动量/目标: 减/加/维持体重) → 若非维持, 再填target weight+target date → 系统跑安全检查(见下), 显示建议或警告 → 用户确认后算出daily targets(calorie+macros) → 存入DB
2. **记录一餐**: 主页大按钮"拍照记录" → 相机拍照(mobile用 `<input capture="environment">`) → 拍照后、分析前可填一个可选text field"补充材料说明"(例如"low fat milk"/"light mayo", 帮AI更精准估算) → 上传Supabase storage(先client端压缩) → 传相片+user_note畀 `/api/analyze-food` (Next.js API route) → route调用Gemini Vision, prompt入面带埋user_note做额外context, 要求回传JSON(食物描述+calories+carbs+protein+fat) → 前端显示分析结果, 用户可手动修正数值后确认save → 写入`meal_logs`, DB trigger或前端即时重算today remaining
3. **记录胰岛素**: 记录一餐果度, 或独立按钮 → 输入units(数字) + 时间(默认now, 可改) → 存`insulin_logs`
4. **主页Dashboard**: 显示今日remaining calories(圆环/进度条, 仿MyFitnessPal风格), remaining carbs/protein/fat, 今日已记录嘅meal+insulin list(时间序), 可tap入历史(按日期回顾, 相片仲在嘅显示相)
5. **数据清理**: Supabase pg_cron(或Netlify scheduled function)每日跑一次, 将 `meal_logs.photo_url` 超过6个月嘅记录, 删除storage实际文件并把该欄位设null(数值数据永久保留)

## 错误处理

- Gemini分析失败/超时 → 前端提示"AI分析失败, 可手动输入营养数据", fallback到手动input表单(calories/carbs/protein/fat数字栏)
- 相片上传失败 → 提示重试, 唔阻塞用户仍可手动输入数值continue
- Gemini识别错误(用户觉得唔准) → 分析结果全部欄位可编辑, 保存前用户确认/修正即可, 唔追求100%自动准确

## 测试/验证方式

- 手动核对: 用几张实际食物相片测试 `/api/analyze-food`, 检查回传JSON结构同数值合理性
- 计算逻辑: 用几组年龄/体重/身高/目标组合, 核对Mifflin-St Jeor计算结果同市面TDEE calculator对比
- End-to-end: 本机 `npm run dev` 走一次完整flow(登入→设profile→拍照记录→睇dashboard remaining更新→记胰岛素→睇历史)
- 部署后: Netlify preview deploy 上实机手机测试PWA加桌面图标、相机拍照input是否正常

## 已知取舍 (YAGNI, 后续可加)

- 冇做多用户/邀请功能 — 单人用, 简单密码登录已够
- 胰岛素纯记录, 唔做剂量建议/计算器 — 避免医疗责任
- 冇做血糖CGM整合 — 用户话唔需要
- 冇做食物数据库/barcode扫描 — 全靠AI识别相片, 后续如AI唔够准可以加手动搜索食物库作为备选
