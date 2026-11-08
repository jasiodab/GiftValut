<?php
$d = $dashboard;
$stats = $d['stats'];
$currency = $d['currency'];
?>
<div class="page-header">
  <div>
    <div class="eyebrow">Overview</div>
    <h1 class="page-title">Your gift collection</h1>
    <p class="page-desc">A considered view of the products you’ve saved, the prices worth watching, and what’s next.</p>
  </div>
</div>

<div class="welcome-card card">
  <div class="welcome-inner">
    <div>
      <div class="welcome-icon"><?= icon('gift') ?></div>
      <h2>Your vault is ready for its first find.</h2>
      <p>Save a product, track its price, and keep every gift idea in one quiet place.</p>
    </div>
    <div class="welcome-aside">
      <div class="welcome-aside-icon"><?= icon('sparkles') ?></div>
      <div>
        <strong>Quick add</strong>
        <small>Paste a store link to begin.</small>
      </div>
    </div>
  </div>
</div>

<div class="stat-grid">
  <div class="card stat-card">
    <div class="stat-top">
      <div class="stat-label">Saved products</div>
      <div class="stat-icon tone-neutral"><?= icon('package') ?></div>
    </div>
    <div class="stat-value"><?= e($stats['totalProducts']) ?></div>
    <div class="stat-detail">In your vault</div>
  </div>
  <div class="card stat-card">
    <div class="stat-top">
      <div class="stat-label">Favorites</div>
      <div class="stat-icon tone-rose"><?= icon('heart') ?></div>
    </div>
    <div class="stat-value"><?= e($stats['favorites']) ?></div>
    <div class="stat-detail">Most-loved finds</div>
  </div>
  <div class="card stat-card">
    <div class="stat-top">
      <div class="stat-label">To buy</div>
      <div class="stat-icon tone-amber"><?= icon('shopping-bag') ?></div>
    </div>
    <div class="stat-value"><?= e($stats['toBuy']) ?></div>
    <div class="stat-detail">Ready for the next occasion</div>
  </div>
  <div class="card stat-card">
    <div class="stat-top">
      <div class="stat-label">Purchased</div>
      <div class="stat-icon tone-sage"><?= icon('check') ?></div>
    </div>
    <div class="stat-value"><?= e($stats['purchased']) ?></div>
    <div class="stat-detail">Gifts already secured</div>
  </div>
  <div class="card stat-card">
    <div class="stat-top">
      <div class="stat-label">Estimated value</div>
      <div class="stat-icon tone-blue"><?= icon('wallet') ?></div>
    </div>
    <div class="stat-value"><?= e(format_compact_money($stats['totalValue'], $currency)) ?></div>
    <div class="stat-detail"><?= e($stats['withPrice']) ?> with price</div>
  </div>
</div>

<div class="card">
  <div class="section-head">
    <div class="section-head-left">
      <div class="section-head-icon"><?= icon('sparkles') ?></div>
      <div>
        <h2>Recently added</h2>
        <p>Your latest finds</p>
      </div>
    </div>
    <a class="section-head-link" href="<?= e(url('/products')) ?>" aria-label="All products"><?= icon('arrow-right') ?></a>
  </div>
  <div class="mini-grid">
    <?php foreach ($d['recentlyAdded'] as $p): ?>
      <a class="mini-product" href="<?= e(url('/products/' . $p['id'])) ?>">
        <div class="mini-thumb">
          <?php if ($p['imageUrl']): ?>
            <img src="<?= e(product_image_url($p['imageUrl'])) ?>" alt="<?= e($p['name']) ?>" style="width:100%;height:100%;object-fit:cover">
          <?php else: ?>
            <div class="product-image-empty"><span><?= icon('gift') ?></span></div>
          <?php endif; ?>
        </div>
        <div class="mini-body">
          <div class="mini-meta">
            <span><?= e($p['category']['name'] ?? 'Other') ?></span>
            <span class="ago"><?= e(time_ago($p['createdAt'])) ?></span>
          </div>
          <div class="mini-name"><?= e($p['name']) ?></div>
          <div class="mini-price-row">
            <div class="mini-price"><?= e(format_money($p['currentPrice'], $p['currency'])) ?></div>
          </div>
        </div>
      </a>
    <?php endforeach; ?>
    <?php if (empty($d['recentlyAdded'])): ?>
      <div class="empty-state compact"><div class="empty-icon"><?= icon('package') ?></div><h3>No products yet</h3><p>Start by adding your first gift idea.</p></div>
    <?php endif; ?>
  </div>
</div>

<div class="card">
  <div class="section-head">
    <div class="section-head-left">
      <div class="section-head-icon"><?= icon('heart') ?></div>
      <div>
        <h2>Favorites</h2>
        <p>Your most-loved finds</p>
      </div>
    </div>
  </div>
  <div class="compact-list">
    <?php foreach ($d['favorites'] as $p): ?>
      <a class="compact-row" href="<?= e(url('/products/' . $p['id'])) ?>">
        <div class="compact-thumb">
          <?php if ($p['imageUrl']): ?>
            <img src="<?= e(product_image_url($p['imageUrl'])) ?>" alt="<?= e($p['name']) ?>" style="width:100%;height:100%;object-fit:cover">
          <?php else: ?>
            <div class="product-image-empty small"><span><?= icon('gift') ?></span></div>
          <?php endif; ?>
        </div>
        <div class="compact-body">
          <div class="compact-name"><?= e($p['name']) ?></div>
          <div class="compact-meta"><?= e($p['category']['name'] ?? 'Other') ?> · <?= e($p['store']['name'] ?? 'Unknown store') ?></div>
        </div>
        <div class="compact-price">
          <strong><?= e(format_money($p['currentPrice'], $p['currency'])) ?></strong>
          <?php if (!empty($p['discountPercent'])): ?>
            <div class="product-discount">-<?= e($p['discountPercent']) ?>%</div>
          <?php endif; ?>
        </div>
      </a>
    <?php endforeach; ?>
    <?php if (empty($d['favorites'])): ?>
      <div class="empty-state compact"><div class="empty-icon"><?= icon('heart') ?></div><h3>No favorites yet</h3><p>Mark products as favorite to see them here.</p></div>
    <?php endif; ?>
  </div>
</div>

<?php if (!empty($d['categorySummary'])): ?>
<div class="card">
  <div class="section-head">
    <div class="section-head-left">
      <div class="section-head-icon"><?= icon('layers') ?></div>
      <div><h2>Collection at a glance</h2><p>By category</p></div>
    </div>
  </div>
  <div class="category-bars">
    <?php
    $maxCount = max(array_map(fn($c) => $c['count'], $d['categorySummary'])) ?: 1;
    foreach ($d['categorySummary'] as $c):
      $pct = $maxCount > 0 ? round($c['count'] / $maxCount * 100) : 0;
    ?>
      <div>
        <div class="category-bar-head">
          <span><span class="cat-dot" style="background:<?= e($c['color']) ?>"></span><?= e($c['name']) ?></span>
          <span><?= e($c['count']) ?></span>
        </div>
        <div class="progress"><span style="width:<?= e($pct) ?>%;background:<?= e($c['color']) ?>"></span></div>
      </div>
    <?php endforeach; ?>
  </div>
</div>
<?php endif; ?>