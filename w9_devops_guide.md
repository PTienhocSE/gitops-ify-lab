# CẨM NANG PHÂN TÍCH HỆ THỐNG GITOPS, OBSERVABILITY & CANARY ROLLOUTS (W9)
> **Phiên bản:** Cực kỳ chi tiết - Tiếp cận theo phương pháp: **Cú pháp (Syntax)** $\rightarrow$ **Mục đích (Purpose)** $\rightarrow$ **Phân tích chi tiết (In-depth Analysis)**.

---

## PHẦN 1: CẤU HÌNH ARGOCD & QUẢN TRỊ GITOPS (Lý thuyết buổi sáng)

### 1.1 Cấu hình Root Application (`argocd/root.yaml`)

#### A. Cú pháp (Syntax)
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: root
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/PTienhocSE/gitops-ify-lab.git
    targetRevision: main
    path: argocd/apps
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

#### B. Mục đích (Purpose)
Đây là cấu hình khai báo **Root Application** đóng vai trò là điểm neo (Entrypoint) duy nhất cho mô hình **App-of-Apps (Ứng dụng của các ứng dụng)**. Nó theo dõi thư mục quản lý ứng dụng con (`argocd/apps`) trên repo Git và tự động đồng bộ hóa để tạo ra các ứng dụng K8s tương ứng mà không cần quản trị viên phải thao tác thủ công trên Cluster hay UI.

#### C. Phân tích chi tiết (In-depth Analysis)
1. **`apiVersion: argoproj.io/v1alpha1` & `kind: Application`**:
   * Định nghĩa một Custom Resource Definition (CRD) được cung cấp bởi ArgoCD. Khi cài đặt ArgoCD, Kubernetes API Server sẽ nhận diện được kiểu tài nguyên phi tiêu chuẩn này.
2. **`metadata.name: root` & `metadata.namespace: argocd`**:
   * Tên ứng dụng gốc là `root`. Nó bắt buộc phải cài đặt trong namespace `argocd` vì đó là nơi Controller của ArgoCD chạy và lắng nghe các tài nguyên kiểu `Application`.
3. **`spec.source` (Nguồn chân lý)**:
   * **`repoURL`**: Đường dẫn tới kho lưu trữ Git chứa toàn bộ code cấu hình. ArgoCD sẽ clone repository này về bộ nhớ đệm (cache) trong Cluster.
   * **`targetRevision: main`**: Trỏ tới nhánh chính `main`. Mỗi khi có commit mới push lên nhánh này, ArgoCD sẽ nhận diện (sau tối đa 3 phút hoặc ngay lập tức nếu cấu hình Git Webhook).
   * **`path: argocd/apps`**: Chỉ định thư mục chứa các YAML cấu hình ứng dụng con. ArgoCD sẽ quét tất cả các file YAML trong thư mục này và triển khai chúng.
4. **`spec.destination` (Đích đến)**:
   * **`server: https://kubernetes.default.svc`**: Đây là URL nội bộ của Kubernetes API Server nằm trong chính cluster mà ArgoCD đang chạy (gọi là *In-cluster*).
   * **`namespace: argocd`**: Nơi lưu giữ các khai báo ứng dụng con.
5. **`spec.syncPolicy` (Chiến lược đồng bộ)**:
   * **`automated.prune: true`**: Khi bạn xóa một file cấu hình ứng dụng con ra khỏi thư mục `argocd/apps/` trên Git, ArgoCD sẽ tự động xóa ứng dụng đó trên Kubernetes. Tránh rác hệ thống.
   * **`automated.selfHeal: true`**: Cơ chế tự phục hồi. Nếu một lập trình viên dùng lệnh `kubectl edit` sửa bậy thông số của Pod trên Cluster, ArgoCD sẽ phát hiện live-state lệch so với git-state và ngay lập tức kéo lại cấu hình gốc đè lên cấu hình bị sửa lỗi.

---

### 1.2 Cấu hình Ứng dụng con Thường (`argocd/apps/web.yaml`)

#### A. Cú pháp (Syntax)
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: web
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/PTienhocSE/gitops-ify-lab.git
    targetRevision: main
    path: k8s/web
  destination:
    server: https://kubernetes.default.svc
    namespace: demo
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

#### B. Mục đích (Purpose)
Đây là cấu hình khai báo ứng dụng con tên là `web`. Nó hướng dẫn ArgoCD lấy các tài nguyên Kubernetes thô (như Namespace, Deployment, Service, ConfigMap) trong thư mục `k8s/web` trên Git và triển khai chúng vào namespace `demo` trên Cluster.

#### C. Phân tích chi tiết (In-depth Analysis)
1. **`spec.source.path: k8s/web`**: Trỏ tới thư mục chứa các manifest Kubernetes gốc của frontend/web.
2. **`spec.destination.namespace: demo`**: Đích đến triển khai dịch vụ thực tế của dự án. Ứng dụng web sẽ không chạy chung namespace `argocd` để đảm bảo bảo mật và tách biệt môi trường (Separation of Concerns).
3. **`syncOptions: - CreateNamespace=true`**: 
   * **Vấn đề:** Nếu namespace `demo` chưa tồn tại trên cluster, quá trình deploy Deployment/Service sẽ thất bại ngay lập tức vì K8s không thể tạo tài nguyên vào một namespace vô hình.
   * **Giải pháp:** Cấu hình này ra lệnh cho ArgoCD tự động chạy lệnh tương đương `kubectl create namespace demo` trước khi cài đặt tài nguyên của ứng dụng `web`.

---

### 1.3 Cấu hình Ứng dụng Helm Chart (`argocd/apps/kube-prometheus-stack.yaml`)

#### A. Cú pháp (Syntax)
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: kube-prometheus-stack
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://prometheus-community.github.io/helm-charts
    chart: kube-prometheus-stack
    targetRevision: 65.1.1
    helm:
      values: |
        prometheus:
          prometheusSpec:
            serviceMonitorSelectorNilUsesHelmValues: false
        alertmanager:
          enabled: true
          config:
            route:
              group_by: ['alertname']
              group_wait: 10s
              group_interval: 10s
              repeat_interval: 1h
              receiver: 'webhook-receiver'
            receivers:
            - name: 'null'
            - name: 'webhook-receiver'
              webhook_configs:
              - url: 'http://alert-mailer.monitoring.svc.cluster.local:8080/alert'
                send_resolved: true
        grafana:
          enabled: false
  destination:
    server: https://kubernetes.default.svc
    namespace: monitoring
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - ServerSideApply=true
```

#### B. Mục đích (Purpose)
Cấu hình này ra lệnh cho ArgoCD tải về biểu đồ ứng dụng (Helm Chart) của bộ giám sát `kube-prometheus-stack` từ bên ngoài Internet, cấu hình lại các thông số cấu hình cụ thể (Alertmanager webhook, tắt Grafana) và triển khai vào namespace `monitoring` để giám sát toàn bộ Cluster.

#### C. Phân tích chi tiết (In-depth Analysis)
1. **`source.repoURL`, `source.chart` & `source.targetRevision`**:
   * Khác với các ứng dụng nội bộ tự viết, nguồn ở đây là một Helm Repository công cộng. ArgoCD sẽ biên dịch template Helm Chart này thành các file manifest Kubernetes thô trước khi áp dụng vào cluster.
2. **`helm.values`**:
   * **`serviceMonitorSelectorNilUsesHelmValues: false`**: Mặc định, Prometheus cài từ Helm Chart chỉ quét các `ServiceMonitor` thuộc cùng bản cài Helm của nó. Đặt giá trị này thành `false` để Prometheus quét toàn bộ các `ServiceMonitor` ở các namespace khác (như namespace `demo` của API).
   * **`alertmanager.config`**: Cấu hình định tuyến Alertmanager. Nếu có cảnh báo xảy ra, Alertmanager gom chúng lại (`group_by: ['alertname']`), chờ 10 giây để nhận thêm cảnh báo đồng hành (`group_wait: 10s`), sau đó gửi dữ liệu dạng JSON thông qua HTTP POST Webhook tới địa chỉ của Mailer Bridge (`alert-mailer` chạy ở cổng 8080).
   * **`send_resolved: true`**: Alertmanager sẽ gửi thêm một webhook báo tin mừng khi sự cố đã được sửa xong để Mailer gửi email thông báo hệ thống đã bình phục (Resolved).
3. **`syncOptions: - ServerSideApply=true`**:
   * **Vấn đề:** Prometheus Custom Resource Definitions (CRDs) cực kỳ lớn. Nếu dùng Client-side apply mặc định, K8s sẽ lưu trữ cấu hình mong muốn vào annotation `kubectl.kubernetes.io/last-applied-configuration` trên Resource. Do giới hạn kích thước của Annotation tối đa chỉ là 262KB, quá trình deploy sẽ vỡ vụn và báo lỗi `annotation too long`.
   * **Giải pháp:** Bật `ServerSideApply` để đẩy việc tính toán khác biệt lên API Server, không dùng annotation lưu cấu hình nữa.

---

## PHẦN 2: ĐIỀU PHỐI ĐỒNG BỘ VỚI SYNC WAVES (Lý thuyết buổi sáng)

### 2.1 Cấu hình Namespace của ứng dụng Web (`k8s/web/namespace.yaml`)

#### A. Cú pháp (Syntax)
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: demo
  annotations:
    argocd.argoproj.io/sync-wave: "-1"
```

#### B. Mục đích (Purpose)
Tạo ra namespace có tên `demo` trên Cluster trước khi bất kỳ tài nguyên nào của ứng dụng Web hay API được cài đặt.

#### C. Phân tích chi tiết (In-depth Analysis)
* **`argocd.argoproj.io/sync-wave: "-1"`**: Trọng số Wave được đặt là `-1`. Vì đây là số âm nhỏ nhất trong các tài nguyên của cụm Web, ArgoCD cam kết sẽ thực thi tạo Namespace này trước tiên. Chỉ khi Namespace này ở trạng thái hoạt động (Active), ArgoCD mới tiến hành chạy các Wave tiếp theo.

---

### 2.2 Cấu hình Tài nguyên Web (`k8s/web/web.yaml`)

#### A. Cú pháp (Syntax)
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: web-config
  namespace: demo
  annotations:
    argocd.argoproj.io/sync-wave: "0"
data:
  MESSAGE: "hello from gitops"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: demo
  annotations:
    argocd.argoproj.io/sync-wave: "1"
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.27
          ports:
            - containerPort: 80
          envFrom:
            - configMapRef:
                name: web-config
---
apiVersion: v1
kind: Service
metadata:
  name: web
  namespace: demo
  annotations:
    argocd.argoproj.io/sync-wave: "2"
spec:
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 80
```

#### B. Mục đích (Purpose)
Khai báo cấu hình biến môi trường (`ConfigMap`), bộ điều khiển chạy Pods (`Deployment`) và cổng kết nối (`Service`) cho dịch vụ Web của bạn. Các tài nguyên này được áp dụng tuần tự để tránh lỗi phụ thuộc chéo.

#### C. Phân tích chi tiết (In-depth Analysis)
1. **Wave 0 (`ConfigMap: web-config`)**:
   * Chạy ngay sau khi Namespace (Wave -1) được tạo. Deployment cần biến môi trường từ ConfigMap này để khởi động Pod. Do đó ConfigMap phải tồn tại trước.
2. **Wave 1 (`Deployment: web`)**:
   * Khởi động 2 Pods chạy Nginx.
   * `envFrom.configMapRef.name: web-config`: Liên kết trực tiếp vào ConfigMap ở Wave 0. Do ConfigMap đã được tạo thành công ở bước trước, quá trình ánh xạ biến môi trường `MESSAGE` vào Pod diễn ra mượt mà, không gặp lỗi chờ tài nguyên.
3. **Wave 2 (`Service: web`)**:
   * Khai báo một dịch vụ định tuyến traffic. Nó chỉ chạy ở bước cuối cùng sau khi Pods đã được khởi tạo và sẵn sàng nhận traffic.

---

## PHẦN 3: KIỂM ĐỊNH TỰ ĐỘNG BẰNG CI PIPELINE (Lý thuyết buổi sáng)

### 3.1 Cấu hình Workflow GitHub Actions (`.github/workflows/validate.yml`)

#### A. Cú pháp (Syntax)
```yaml
name: Validate Kubernetes Manifests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  kubeconform:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Run kubeconform
      uses: docker://ghcr.io/yannh/kubeconform:v0.6.7-alpine
      with:
        entrypoint: '/kubeconform'
        args: "-summary -strict -ignore-missing-schemas argocd/ k8s/ k8s-api/"
```

#### B. Mục đích (Purpose)
Chạy tự động mỗi khi lập trình viên thực hiện commit code hoặc tạo Pull Request vào nhánh `main`. Nhiệm vụ của nó là kiểm tra xem tất cả các file cấu hình YAML định nghĩa Kubernetes có viết đúng cú pháp và tuân thủ đặc tả kỹ thuật tiêu chuẩn (Schema) của Kubernetes hay không.

#### C. Phân tích chi tiết (In-depth Analysis)
1. **`on.push.branches` & `on.pull_request.branches`**: Định nghĩa các sự kiện kích hoạt (Triggers). Tránh việc lọt file cấu hình lỗi vào nhánh `main` - nhánh mà ArgoCD đang trực tiếp lắng nghe.
2. **`kubeconform` vs `kubeval`**: `kubeconform` là phiên bản cải tiến, viết bằng Go có hiệu năng cao, hỗ trợ xác thực schema của các phiên bản Kubernetes mới nhất.
3. **Ý nghĩa các tham số lệnh (`args`)**:
   * **`-summary`**: Gom nhóm và xuất báo cáo ngắn gọn ở cuối phiên chạy (xem có bao nhiêu file pass, bao nhiêu file lỗi).
   * **`-strict`**: Chế độ nghiêm ngặt. Nếu trong file YAML của bạn thừa một thuộc tính không được định nghĩa trong tài liệu K8s (ví dụ gõ nhầm tên trường), nó sẽ đánh sập build (Fail).
   * **`-ignore-missing-schemas`**: Bỏ qua các Custom Resources như ứng dụng của ArgoCD hoặc cấu hình Prometheus. Do các schema này không nằm trong thư viện schema Kubernetes mặc định của Kubeconform, nếu không bỏ qua, công cụ sẽ báo lỗi "không tìm thấy schema" cho tất cả các file đó.

---

## PHẦN 4: OBSERVABILITY - GIÁM SÁT & SLOs (Lý thuyết buổi chiều)

### 4.1 Mã nguồn Flask API Metrics Exporter (`app/app.py`)

#### A. Cú pháp (Syntax)
```python
import os
import random
from flask import Flask, jsonify
from prometheus_flask_exporter import PrometheusMetrics

app = Flask(__name__)
PrometheusMetrics(app)

ERR = float(os.getenv("ERROR_RATE", "0"))
VER = os.getenv("VERSION", "v1")

@app.get("/")
def index():
    if random.random() < ERR:
        return jsonify(error="injected", version=VER), 500
    return jsonify(ok=True, version=VER)

@app.get("/healthz")
def healthz():
    return "ok", 200
```

#### B. Mục đích (Purpose)
Ứng dụng API viết bằng Python Flask. Nó tích hợp thư viện Prometheus Exporter để tự động đếm các lượt truy cập HTTP, đo lường thời gian phản hồi (latency), phân loại mã trạng thái trả về (200, 500...) và phơi bày các dữ liệu thô này ra đường dẫn `/metrics`. Ngoài ra nó còn có cơ chế giả lập lỗi dựa vào biến môi trường `ERROR_RATE` để chúng ta test khả năng phát hiện lỗi của Prometheus.

#### C. Phân tích chi tiết (In-depth Analysis)
1. **`PrometheusMetrics(app)`**:
   * Dòng này tự động can thiệp vào vòng đời xử lý request của Flask (Middleware). Với mỗi request đi qua, nó tự động cập nhật vào các biến đo lường nội bộ của Prometheus:
     * `flask_http_request_total` (Kiểu Counter - Đếm số lượng request).
     * `flask_http_request_duration_seconds` (Kiểu Histogram - Đo thời gian xử lý request).
   * Đồng thời tự động đăng ký endpoint `/metrics` trên web server.
2. **`random.random() < ERR`**:
   * Nếu biến môi trường `ERROR_RATE` được gán giá trị `"0.1"` ($10\%$), hàm `random.random()` (trả về số ngẫu nhiên từ $0.0$ đến $1.0$) sẽ có xác suất $10\%$ trả về giá trị nhỏ hơn $0.1$. Khi đó, app sẽ chủ động trả về mã lỗi HTTP 500. Kỹ thuật này dùng để mô phỏng "Burn Rate" (tốc độ tiêu hao ngân sách lỗi) và kiểm định xem hệ thống cảnh báo có hoạt động hay không.

---

### 4.2 Cấu hình Prometheus ServiceMonitor (`k8s-api/servicemonitor.yaml`)

#### A. Cú pháp (Syntax)
```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: api
  namespace: demo
spec:
  selector:
    matchLabels:
      app: api
  endpoints:
  - port: http
    path: /metrics
    interval: 15s
```

#### B. Mục đích (Purpose)
Liên kết giữa K8s Service của ứng dụng API với hệ thống Prometheus. Nó hướng dẫn Prometheus định kỳ tìm kiếm các Pod phía sau Service mang nhãn `app: api` và thực hiện cào (scrape) dữ liệu số đo từ endpoint `/metrics`.

#### C. Phân tích chi tiết (In-depth Analysis)
1. **`apiVersion: monitoring.coreos.com/v1` & `kind: ServiceMonitor`**:
   * Đây là tài nguyên CRD của Prometheus Operator. Nó trừu tượng hóa cấu hình thu thập dữ liệu giúp lập trình viên không cần can thiệp trực tiếp vào file config `prometheus.yml` cồng kềnh.
2. **`spec.selector.matchLabels.app: api`**:
   * Prometheus sẽ tìm các Kubernetes Service nào trong Namespace có nhãn `app: api` để lấy danh sách IP của các Pod chạy phía sau.
3. **`endpoints.interval: 15s`**:
   * Tần suất cào dữ liệu. Mỗi 15 giây, Prometheus sẽ gửi một request HTTP GET tới IP của từng Pod `/metrics` để lấy dữ liệu mới nhất. Khoảng cách này càng nhỏ thì dữ liệu giám sát càng thời gian thực (real-time) nhưng sẽ làm tăng tải CPU/RAM cho Prometheus Server nếu số lượng Pod quá lớn.

---

### 4.3 Cấu hình Cảnh báo SLO (`k8s-api/prometheusrule.yaml`)

#### A. Cú pháp (Syntax)
```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: api-slo-alerts
  namespace: demo
  labels:
    release: kube-prometheus-stack
spec:
  groups:
  - name: api-slo.rules
    rules:
    - alert: ApiSuccessRateLow
      expr: sum(rate(flask_http_request_total{namespace="demo",status!~"5.."}[2m])) / sum(rate(flask_http_request_total{namespace="demo"}[2m])) < 0.95
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "API Success Rate is low"
        description: "The API success rate has dropped below 95%. Current value is {{ $value }}."
```

#### B. Mục đích (Purpose)
Thiết lập luật cảnh báo ở tầng Prometheus. Nếu tỷ lệ thành công của dịch vụ API (SLI) tụt xuống dưới mức cam kết mục tiêu ($95\%$ - SLO) và duy trì trạng thái tệ hại này liên tục trong 1 phút, Prometheus sẽ kích hoạt trạng thái báo động `Firing` và chuyển thông tin này sang Alertmanager để gửi đi.

#### C. Phân tích chi tiết (In-depth Analysis)
1. **`metadata.labels.release: kube-prometheus-stack`**:
   * **Bắt buộc:** Đây là nhãn bộ lọc giúp cấu hình Prometheus tự động quét và nạp các rules này vào động cơ xử lý của nó.
2. **Giải nghĩa câu truy vấn PromQL toán học (`expr`)**:
   $$\text{Success Rate} = \frac{\sum \text{Tốc độ request/giây của các request có status không phải 5xx trong 2 phút qua}}{\sum \text{Tốc độ tất cả request/giây trong 2 phút qua}}$$
   * `status!~"5.."`: Ký tự `!~` đại diện cho biểu thức chính quy Regex phủ định. Loại bỏ các mã lỗi máy chủ dạng 5xx (500, 502, 503).
   * Nếu tỉ số này trả về giá trị $< 0.95$ (ví dụ: $0.90$ - tức $90\%$ thành công, hệ thống đang lỗi $10\%$), biểu thức logic trả về `True` và bắt đầu kích hoạt điều kiện tính thời gian.
3. **`for: 1m`**:
   * Thời gian chờ tạm thời (Pending state). Nếu tỉ lệ lỗi chỉ tăng đột biến trong 10-20 giây rồi tự động giảm lại về bình thường, cảnh báo sẽ tự hủy mà không gửi mail, tránh tạo ra các "cảnh báo rác" (alert fatigue) làm phiền kỹ sư trực đêm. Chỉ khi lỗi kéo dài đủ 1 phút, nó mới chính thức kích hoạt.
4. **`annotations.description: "... {{ $value }}."`**:
   * Cú pháp `{{ $value }}` là một biến nội tại đại diện cho giá trị thực tế đo được tại thời điểm xảy ra sự cố (ví dụ: `0.88`). Giúp kỹ sư vận hành biết ngay mức độ nghiêm trọng khi đọc email cảnh báo.

---

## PHẦN 5: PROGRESSIVE DELIVERY VỚI ARGO ROLLOUTS (Lý thuyết buổi chiều)

### 5.1 Cấu hình Canary Rollout Dịch vụ API (`k8s-api/api.yaml`)

#### A. Cú pháp (Syntax)
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: api
  namespace: demo
  labels:
    app: api
spec:
  replicas: 4
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
      - name: api
        image: w9-api:1
        imagePullPolicy: IfNotPresent
        ports:
        - name: http
          containerPort: 8080
        env:
        - name: ERROR_RATE
          value: "0"
        - name: VERSION
          value: "v7"
        readinessProbe:
          httpGet:
            path: /healthz
            port: 8080
  strategy:
    canary:
      analysis:
        templates:
        - templateName: success-rate
      steps:
      - setWeight: 25
      - pause: { duration: 3m }
      - setWeight: 50
      - pause: { duration: 1m }
      - setWeight: 100
---
apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: demo
  labels:
    app: api
spec:
  ports:
  - port: 8080
    targetPort: 8080
    protocol: TCP
    name: http
  selector:
    app: api
```

#### B. Mục đích (Purpose)
Khai báo triển khai dịch vụ API sử dụng bộ điều khiển **Argo Rollouts** để thực hiện cập nhật phiên bản mới theo chiến lược **Canary (Chim sẻ đi mưa)**. Thay vì nâng cấp ồ ạt toàn bộ hệ thống, nó sẽ nâng cấp từng phần (25%, rồi 50%, rồi 100%) và kết nối trực tiếp với tài nguyên Phân tích chất lượng (`AnalysisTemplate`) để tự động rollback bảo vệ hệ thống nếu phát hiện lỗi.

#### C. Phân tích chi tiết (In-depth Analysis)
1. **`kind: Rollout`**: Thay thế trực tiếp cho tài nguyên `Deployment` tiêu chuẩn của Kubernetes.
2. **`strategy.canary`**:
   * **`steps`**: Mô tả tiến trình cập nhật ứng dụng.
     1. **`setWeight: 25`**: Argo Rollouts sẽ tính toán: $25\%$ của tổng số 4 Pods (`replicas: 4`) là 1 Pod. Nó sẽ khởi chạy 1 Pod mang phiên bản mới (ví dụ: `v2`), đồng thời tắt bớt 1 Pod phiên bản cũ (`v1`). Traffic từ Client đi vào Service sẽ được định tuyến ngẫu nhiên: $25\%$ vào Pod mới, $75\%$ còn lại vẫn chạy vào 3 Pod cũ ổn định.
     2. **`pause: { duration: 3m }`**: Trạng thái Rollout sẽ bị tạm dừng trong 3 phút. Trong thời gian này, hệ thống sẽ thực thi việc đo lường dữ liệu thông qua phân tích tự động.
     3. **`setWeight: 50`**: Nếu sau 3 phút phân tích thành công (không kích hoạt rollback), nó tăng tỷ lệ Pod mới lên 2 Pod ($50\%$).
     4. **`setWeight: 100`**: Hoàn tất cập nhật, toàn bộ 4 Pod đều chạy phiên bản mới.
3. **`strategy.canary.analysis`**:
   * **`templates.templateName: success-rate`**: Khai báo mẫu phân tích sẽ sử dụng trong quá trình pause. Cứ mỗi khoảng thời gian cấu hình trong template đó, nó sẽ tự động chạy phân tích song song khi Rollout đang thực hiện các bước Canary.

---

### 5.2 Cấu hình Phân tích Tự động (`k8s-api/analysis.yaml`)

#### A. Cú pháp (Syntax)
```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate
  namespace: demo
spec:
  metrics:
  - name: success-rate
    interval: 30s
    successCondition: len(result) == 0 || result[0] >= 0.95
    failureLimit: 2
    provider:
      prometheus:
        address: http://kube-prometheus-stack-prometheus.monitoring.svc.cluster.local:9090
        query: |
          sum(rate(flask_http_request_total{namespace="demo",status!~"5.."}[2m]))
          /
          sum(rate(flask_http_request_total{namespace="demo"}[2m]))
```

#### B. Mục đích (Purpose)
Định nghĩa phương pháp tính toán chất lượng của phiên bản Canary đang được cập nhật. Nó đóng vai trò là "Thẩm phán" tự động đưa ra quyết định: Cho phép tiếp tục nâng cấp (Promote) hay lập tức huỷ bỏ cập nhật và quay về bản cũ (Abort/Rollback).

#### C. Phân tích chi tiết (In-depth Analysis)
1. **`interval: 30s`**: Cứ 30 giây một lần, Argo Rollouts Controller sẽ gửi truy vấn PromQL tới Prometheus.
2. **`successCondition: len(result) == 0 || result[0] >= 0.95`**:
   * `len(result) == 0`: Khi ứng dụng mới khởi chạy, chưa hề có request nào gửi tới, kết quả PromQL trả về danh sách rỗng. Điều kiện này giúp tránh lỗi phân tích khi hệ thống không có dữ liệu (không có traffic).
   * `result[0] >= 0.95`: Lấy kết quả đầu tiên của danh sách truy vấn Prometheus. Giá trị này phải $\ge 95\%$.
3. **`failureLimit: 2`**:
   * **Cơ chế hoạt động:** Nếu một lần kiểm tra cho kết quả Success Rate $< 95\%$, Argo Rollouts sẽ ghi nhận 1 điểm phạt (Failure). Nó chưa rollback ngay lập tức vì có thể do nghẽn mạng nhất thời. Tuy nhiên, nếu số lần phạt liên tiếp vượt quá hạn mức là `2` (tức lần truy vấn thứ 3 vẫn thất bại), hệ thống sẽ lập tức kích hoạt trạng thái **Abort**.
   * Khi trạng thái Abort được kích hoạt: Argo Rollouts sẽ ngay lập tức chuyển toàn bộ traffic về các Pod của phiên bản cũ đang chạy và tắt sạch các Pod của phiên bản mới lỗi. Đảm bảo thời gian gián đoạn dịch vụ của khách hàng là ngắn nhất.

---

## PHẦN 6: CHU TRÌNH EMAIL ALERTING & CHALLENGE (Lý thuyết & Thử thách buổi chiều)

### 6.1 Cấu hình Mailer Bridge Deployment & Service (`k8s-api/mailer.yaml`)

#### A. Cú pháp (Syntax)
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alert-mailer
  namespace: monitoring
  labels:
    app: alert-mailer
spec:
  replicas: 1
  selector:
    matchLabels:
      app: alert-mailer
  template:
    metadata:
      labels:
        app: alert-mailer
    spec:
      containers:
      - name: alert-mailer
        image: alert-mailer:1
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 8080
        env:
        - name: GOOGLE_MAILER_CLIENT_ID
          valueFrom:
            secretKeyRef:
              name: alert-mailer-secret
              key: client-id
        - name: GOOGLE_MAILER_CLIENT_SECRET
          valueFrom:
            secretKeyRef:
              name: alert-mailer-secret
              key: client-secret
        - name: GOOGLE_MAILER_REFRESH_TOKEN
          valueFrom:
            secretKeyRef:
              name: alert-mailer-secret
              key: refresh-token
        - name: ADMIN_EMAIL_ADDRESS
          valueFrom:
            secretKeyRef:
              name: alert-mailer-secret
              key: admin-email
        - name: FROM_NAME
          valueFrom:
            secretKeyRef:
              name: alert-mailer-secret
              key: from-name
        - name: TO_EMAIL
          valueFrom:
            secretKeyRef:
              name: alert-mailer-secret
              key: to-email
        readinessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: alert-mailer
  namespace: monitoring
  labels:
    app: alert-mailer
spec:
  ports:
  - port: 8080
    targetPort: 8080
    protocol: TCP
    name: http
  selector:
    app: alert-mailer
```

#### B. Mục đích (Purpose)
Triển khai một Pod chạy ứng dụng trung gian nhận Webhook từ Alertmanager, dịch thông tin cảnh báo JSON thô thành định dạng HTML trực quan và thực hiện gửi Email cảnh báo bảo mật qua dịch vụ Google Gmail OAuth2.

#### C. Phân tích chi tiết (In-depth Analysis)
1. **`namespace: monitoring`**: Ứng dụng này được đặt trong namespace `monitoring` để Alertmanager trong cùng namespace có thể giao tiếp dễ dàng thông qua DNS nội bộ của Kubernetes (`http://alert-mailer:8080/alert`).
2. **`env.valueFrom.secretKeyRef`**:
   * **Bảo mật tuyệt đối:** Các khoá bí mật nhạy cảm (Google Client Secret, Refresh Token) không bao giờ được viết trực tiếp (Hardcode) vào file YAML đẩy lên Git. GitOps cấm tuyệt đối điều này.
   * **Giải pháp:** Sử dụng K8s Secret `alert-mailer-secret` để lưu trữ ngoại tuyến trên Cluster. File YAML chỉ chứa liên kết trỏ tới Secret này.
3. **`readinessProbe`**:
   * Kiểm tra Pod đã sẵn sàng hoạt động hay chưa bằng cách gọi GET `/healthz` sau khi khởi chạy 5 giây (`initialDelaySeconds: 5`). Đảm bảo hệ thống định tuyến traffic chỉ chuyển yêu cầu tới Pod khi Node.js Server đã lắng nghe thành công trên cổng 8080.

---

### 6.2 Mã nguồn Mailer Webhook Bridge (`app-mailer/server.js`)

#### A. Cú pháp (Syntax)
```javascript
const express = require('express');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const CLIENT_ID = process.env.GOOGLE_MAILER_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_MAILER_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_MAILER_REFRESH_TOKEN;
const FROM_EMAIL = process.env.ADMIN_EMAIL_ADDRESS || 'kickslabss@gmail.com';
const FROM_NAME = process.env.FROM_NAME || 'AWS Alertmanager';
const TO_EMAIL = process.env.TO_EMAIL || 'ptientr.dev@gmail.com';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: FROM_EMAIL,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    refreshToken: REFRESH_TOKEN
  }
});

app.post('/alert', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload.alerts || payload.alerts.length === 0) {
      return res.status(200).send('No alerts in payload');
    }

    let emailSubject = `[Alertmanager] ${payload.status.toUpperCase()}: ${payload.alerts.length} alert(s)`;
    if (payload.alerts.length === 1) {
      const firstAlert = payload.alerts[0];
      emailSubject = `[Alertmanager] ${firstAlert.status.toUpperCase()}: ${firstAlert.labels.alertname}`;
    }

    let emailHtml = `<h2>Alertmanager Status: <span style="color: ${payload.status === 'firing' ? 'red' : 'green'}">${payload.status.toUpperCase()}</span></h2>`;

    payload.alerts.forEach((alert, index) => {
      const name = alert.labels.alertname || 'Unknown Alert';
      const severity = alert.labels.severity || 'info';
      const summary = alert.annotations.summary || '';
      const description = alert.annotations.description || '';
      const status = alert.status.toUpperCase();
      const time = alert.startsAt;

      emailHtml += `
        <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px; background-color: ${status === 'FIRING' ? '#fff5f5' : '#f5fff5'}">
          <h3 style="margin-top: 0; color: ${status === 'FIRING' ? '#d32f2f' : '#388e3c'}">${name} - ${status}</h3>
          <p><strong>Severity:</strong> <span style="text-transform: uppercase; font-weight: bold;">${severity}</span></p>
          <p><strong>Summary:</strong> ${summary}</p>
          <p><strong>Description:</strong> ${description}</p>
          <p><strong>Time:</strong> ${time}</p>
        </div>
      `;
    });

    await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: TO_EMAIL,
      subject: emailSubject,
      html: emailHtml
    });

    res.status(200).send('Alert email sent successfully');
  } catch (error) {
    res.status(500).send(`Failed to send alert email: ${error.message}`);
  }
});

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`Alert mailer bridge listening on port ${PORT}`);
});
```

#### B. Mục đích (Purpose)
Tiếp nhận gói tin JSON định dạng chuẩn của Alertmanager, chuyển đổi dữ liệu thô này thành email HTML có giao diện dễ nhìn (đỏ khi đang lỗi, xanh lá khi đã khắc phục xong) và dùng giao thức OAuth2 bảo mật để yêu cầu Gmail API gửi email thông báo trực tiếp cho quản trị viên.

#### C. Phân tích chi tiết (In-depth Analysis)
1. **Tại sao phải dùng OAuth2 thay vì mật khẩu thông thường?**:
   * **Bảo mật của Google:** Google hiện tại đã chặn hoàn toàn việc sử dụng mật khẩu tài khoản trực tiếp hoặc cấu hình "Less Secure Apps" (ứng dụng kém an toàn) để gửi mail từ Node.js.
   * **Cơ chế OAuth2:** Sử dụng bộ ba thông tin `ClientId`, `ClientSecret` và `RefreshToken`. Bộ thông tin này cấp quyền hạn chế (chỉ được gửi email) và có thể dễ dàng bị thu hồi từ trang quản trị Google API Console nếu thông tin bị lộ, đảm bảo an toàn tối đa cho tài khoản Gmail chính.
2. **Cấu trúc dữ liệu của payload nhận từ Alertmanager**:
   * Gói tin JSON từ Alertmanager gửi tới có cấu trúc dạng:
     ```json
     {
       "status": "firing",
       "alerts": [
         {
           "status": "firing",
           "labels": { "alertname": "ApiSuccessRateLow", "severity": "critical" },
           "annotations": { "summary": "...", "description": "..." },
           "startsAt": "2026-06-12T01:50:00Z"
         }
       ]
     }
     ```
   * Vòng lặp `payload.alerts.forEach` bóc tách từng lỗi trong danh sách (vì có thể có nhiều cảnh báo được gom nhóm cùng gửi đi một lúc) để dựng lên giao diện CSS tương ứng:
     * `status === 'FIRING'`: Nền email chuyển sang màu đỏ nhạt (`#fff5f5`), tiêu đề cảnh báo màu đỏ đậm (`#d32f2f`).
     * `status === 'RESOLVED'`: Nền email chuyển sang màu xanh lá nhạt (`#f5fff5`), tiêu đề cảnh báo màu xanh lá đậm (`#388e3c`).

---

## TẤT CẢ CÁC BƯỚC THIẾT LẬP VÀ VẬN HÀNH THỰC TẾ (Hệ thống hóa Lab)

Để giúp bạn hình dung toàn bộ bức tranh cách vận hành lab tuần 9, dưới đây là chuỗi hành động thực tế đã diễn ra:

1. **Khởi tạo hạ tầng:** Bạn dùng Terraform tạo ra 1 máy ảo EC2 (`t3.large`), cài đặt Minikube để giả lập K8s Cluster nhỏ gọn và cài đặt ArgoCD lên đó.
2. **Kích hoạt GitOps:** Bạn áp dụng file [root.yaml](file:///d:/Workspace/Study/AWS/gitops-ify-lab/argocd/root.yaml) vào Cluster. ArgoCD tự động sinh ra các ứng dụng con: `web`, `backend`, `frontend`, `api`, `kube-prometheus-stack` và `argo-rollouts`.
3. **Kiểm tra và giám sát:**
   * Kubernetes Service Monitor kết nối và truyền dữ liệu cho Prometheus Server.
   * Khi bạn cập nhật tag hình ảnh phiên bản mới cho API trong [api.yaml](file:///d:/Workspace/Study/AWS/gitops-ify-lab/k8s-api/api.yaml) (Ví dụ: thay đổi sang `v7` và commit đẩy lên Git).
   * ArgoCD tự động kéo cấu hình mới về Cluster. Argo Rollout bắt đầu quy trình Canary bước 1: chuyển $25\%$ traffic sang Pod mới.
   * Rollout Controller gọi AnalysisTemplate để quét Prometheus.
   * **Nếu thành công:** Tỷ lệ lỗi $= 0\% \rightarrow$ Success Rate $\ge 95\% \rightarrow$ Hết thời gian chờ, hệ thống tăng dần lên $50\%$ traffic, rồi kết thúc thành công ở $100\%$ traffic.
   * **Nếu thất bại (Challenge):** Bạn cấu hình biến môi trường `ERROR_RATE: "0.2"` ($20\%$ lỗi).
     * Khi traffic Canary chạy qua, lỗi 500 sinh ra $\rightarrow$ Prometheus quét được tỉ lệ thành công thực tế tụt xuống $80\% < 95\%$ (Vi phạm SLO).
     * Cảnh báo `ApiSuccessRateLow` được kích hoạt ở trạng thái Firing.
     * Alertmanager nhận cảnh báo và bắn Webhook tới Mailer Bridge. Mailer Bridge ngay lập tức gửi một email màu đỏ cảnh báo tới hòm thư `ptientr.dev@gmail.com`.
     * Đồng thời, Argo Rollouts phát hiện AnalysisTemplate báo cáo chỉ số thất bại quá 2 lần, nó tự động huỷ bỏ (Abort) quá trình cập nhật, lập tức rollback đưa toàn bộ traffic trở lại phiên bản cũ an toàn.
