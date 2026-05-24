Lv999 媒体素材导入说明
========================

【本地使用】
  1. 把文件放进 assets/music、assets/images、assets/video
  2. 双击 sync-media.bat（会生成 media.json 和缩略图）
  3. 双击 start-server.bat，浏览器打开 http://localhost:8080

【上传到 GitHub / GitHub Pages】
  目录必须是 assets（不要写成 assests）

  需要上传的内容：
    index.html、css/、js/
    assets/config.json
    assets/media.json（运行 sync-media.bat 后生成）
    assets/music/*.mp3
    assets/images/*（图片原图）
    assets/images/_thumb/*（sync-media.bat 自动生成）
    assets/video/*.mp4（可选，体积大）

  GitHub Pages 设置：
    分支选 主干（或 main），目录选 /（根目录）

  线上逻辑：
    - 优先读 assets/media.json
    - 若某类为空，自动从 GitHub 仓库扫描对应文件夹
    - 路径使用同站相对地址，例如 assets/music/xxx.mp3

【修改仓库信息】
  编辑 assets/config.json 里的 remoteMedia.repo / branch

【板块分离】
  游戏 → 像素风合成 BGM/音效（内置）
  音乐库 / 图库 / 视频 → 独立页面，素材来自 assets/
