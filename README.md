# 協會地理位置搜尋與管理系統

## 啟動

1. 在 VS Code 開啟此資料夾，安裝並啟用 **Live Server** 擴充套件。
2. 在 `index.html` 按右鍵，選擇 **Open with Live Server**。
3. 預設資料由 `data/associations.json` 載入；請使用 HTTP 網址（Live Server），不要直接用 `file://` 開啟。

原始活頁簿 `舊衣回收箱.xlsx` 未修改。此專案資料 JSON 是從其第一個工作表轉換而成。若要載入另一個活頁簿，按頁首「載入 Excel」並選取檔案，程式會在瀏覽器以 SheetJS 讀取第一個工作表，不會上傳檔案或覆寫原檔。

## Google Maps API 金鑰

1. 在 Google Cloud Console 建立專案並啟用 **Maps JavaScript API**，設定帳單及 API 金鑰。
2. 在本機 `js/config.js` 將 `googleMapsApiKey` 設為金鑰。部署時請在 Google Cloud Console 設定 HTTP referrer 限制。公開儲存庫不應提交含金鑰的設定檔；本儲存庫的設定預設為空白。
3. 如需使用自有地圖樣式 ID，將 `googleMapsMapId` 改為該 Map ID。預設使用 `DEMO_MAP_ID` 以支援 Advanced Markers。

若未設定 API 金鑰，資料、搜尋、清單與圖例仍可使用；地圖及導航標記需在本機設定金鑰後使用。GitHub Pages 的靜態頁面不會自動取得本機金鑰。

## Excel 欄位

目前活頁簿第一個工作表的欄位為「自編號、協會編號、協會及類別、地址、緯度、經度」。程式保留編號文字、驗證座標範圍，並容許無效／缺少座標的資料留在清單中。此檔的「協會及類別」欄位將「私人」辨識為私人，其餘機構名稱列為協會；若新檔使用不同標題，可在 `js/config.js` 的 `columnMapping` 逐欄指定實際標題。

協會標記樣式以協會名稱排序後固定配置，不會因搜尋結果而改變。搜尋條件可交叉套用，點圖例會在目前搜尋結果內再篩選。
