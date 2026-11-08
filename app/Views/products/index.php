<?php
$products = $products ?? [];
$pagination = $pagination ?? ['page'=>1,'totalPages'=>1,'total'=>0];
$filters = $filters ?? [];
$categories = $categories ?? [];
$tags = $tags ?? [];
$settings = $settings ?? ['defaultProductView'=>'grid','currency'=>'PLN'];
$view = $filters['view'] ?? $settings['defaultProductView'] ?? 'grid';
?>
<div class="page-header">
  <div>
    <div class="eyebrow">Collection</div>
    <h1 class="page-title">All products</h1>
    <p class="page-desc">
      <?php if (($pagination['total'] ?? 0) > 0): ?>
        <?= e($pagination['total']) ?> saved product<?= $pagination['total'] === 1 ? '' : 's' ?> matching your filters
      <?php else: ?>
        Every thoughtful find, organized in one place.
      <?php endif; ?>
    </p>
  </div>
  <div class="page-actions">
    <button class="btn btn-sm" type="button" id="quickAddBtn3"><?= icon('plus') ?> Add product</button>
  </div>
</div>

<div class="card toolbar">
  <div class="toolbar-inner">
    <form method="get" action="<?= e(url('/products')) ?>" class="toolbar-controls" style="width:100%">
      <div class="search-field">
        <?= icon('search') ?>
        <input class="input" type="text" name="search" value="<?= e($filters['search'] ?? '') ?>" placeholder="Search products, stores, notes or tags…" aria-label="Search">
        <?php if (!empty($filters['search'])): ?>
          <button class="search-clear" type="button" onclick="this.form.search.value='';this.form.submit()"><?= icon('x') ?></button>
        <?php endif; ?>
      </div>
      <select class="select" name="status">
        <option value="ALL" <?= ($filters['status'] ?? 'ALL') === 'ALL' ? 'selected' : '' ?>>All statuses</option>
        <option value="TO_CONSIDER" <?= ($filters['status'] ?? '') === 'TO_CONSIDER' ? 'selected' : '' ?>>To consider</option>
        <option value="FAVORITE" <?= ($filters['status'] ?? '') === 'FAVORITE' ? 'selected' : '' ?>>Favorite</option>
        <option value="TO_BUY" <?= ($filters['status'] ?? '') === 'TO_BUY' ? 'selected' : '' ?>>To buy</option>
        <option value="PURCHASED" <?= ($filters['status'] ?? '') === 'PURCHASED' ? 'selected' : '' ?>>Purchased</option>
      </select>
      <select class="select" name="categoryId">
        <option value="">All categories</option>
        <?php foreach ($categories as $c): ?>
          <option value="<?= e($c['id']) ?>" <?= ($filters['categoryId'] ?? '') === $c['id'] ? 'selected' : '' ?>><?= e($c['name']) ?></option>
        <?php endforeach; ?>
      </select>
      <select class="select" name="sort">
        <option value="recent" <?= ($filters['sort'] ?? 'recent') === 'recent' ? 'selected' : '' ?>>Recently added</option>
        <option value="updated" <?= ($filters['sort'] ?? '') === 'updated' ? 'selected' : '' ?>>Recently updated</option>
        <option value="price-asc" <?= ($filters['sort'] ?? '') === 'price-asc' ? 'selected' : '' ?>>Price: low to high</option>
        <option value="price-desc" <?= ($filters['sort'] ?? '') === 'price-desc' ? 'selected' : '' ?>>Price: high to low</option>
        <option value="name" <?= ($filters['sort'] ?? '') === 'name' ? 'selected' : '' ?>>Name A–Z</option>
      </select>
      <label class="inline-flex items-center gap-2 small">
        <input type="checkbox" name="favorite" value="true" <?= !empty($filters['favorite']) ? 'checked' : '' ?>> Favorites only
      </label>
      <button class="btn btn-sm" type="submit">Filter</button>
    </form>
  </div>
</div>

<div class="bulk-bar" id="bulkBar" style="display:none">
  <div class="bulk-left">
    <span class="bulk-label"><span id="bulkCount">0</span> selected</span>
  </div>
  <div class="bulk-actions">
    <button class="btn btn-outline btn-sm" type="button" id="bulkFavorite"><?= icon('heart') ?> Favorite</button>
    <button class="btn btn-outline btn-sm" type="button" id="bulkStatus"><?= icon('tag') ?> Status</button>
    <button class="btn btn-destructive btn-sm" type="button" id="bulkDelete"><?= icon('trash-2') ?> Delete</button>
  </div>
</div>

<?php if (empty($products)): ?>
  <div class="empty-state">
    <div class="empty-icon"><?= icon('package') ?></div>
    <h3><?= !empty($filters['search']) || ($filters['status'] ?? 'ALL') !== 'ALL' || !empty($filters['categoryId']) ? 'No products match these filters' : 'Your vault is empty' ?></h3>
    <p><?= !empty($filters['search']) || ($filters['status'] ?? 'ALL') !== 'ALL' || !empty($filters['categoryId']) ? 'Try adjusting your filters.' : 'Add your first product to get started.' ?></p>
    <div class="empty-action">
      <button class="btn btn-sm" type="button" id="quickAddBtn4"><?= icon('plus') ?> Add product</button>
    </div>
  </div>
<?php else: ?>
  <div class="<?= ($settings['defaultProductView'] ?? 'grid') === 'list' ? 'product-list' : 'product-grid' ?>" id="productContainer">
    <?php foreach ($products as $p): ?>
      <?php $isFav = $p['status'] === 'FAVORITE'; ?>
      <article class="product-card" data-id="<?= e($p['id']) ?>">
        <a class="product-card-link" href="<?= e(url('/products/' . $p['id'])) ?>" aria-label="Open <?= e($p['name']) ?>"></a>
        <div class="product-media">
          <div class="product-image">
            <?php if ($p['imageUrl']): ?>
              <img src="<?= e(product_image_url($p['imageUrl'])) ?>" alt="<?= e($p['name']) ?>" loading="lazy">
            <?php else: ?>
              <div class="product-image-empty"><span><?= icon('gift') ?></span><span>No image</span></div>
            <?php endif; ?>
          </div>
          <div class="product-select"><input class="checkbox bulk-check" type="checkbox" value="<?= e($p['id']) ?>" aria-label="Select <?= e($p['name']) ?>"></div>
          <button class="product-fav <?= $isFav ? 'is-favorite' : '' ?>" type="button" data-fav="<?= e($p['id']) ?>" aria-label="Toggle favorite"><?= icon('heart') ?></button>
        </div>
        <div class="product-body">
          <div class="product-meta">
            <?php if ($p['category']): ?>
              <span class="cat-dot" style="background:<?= e($p['category']['color']) ?>"></span>
              <span class="cat-name"><?= e($p['category']['name']) ?></span>
              <span class="sep">·</span>
            <?php endif; ?>
            <span class="store"><?= e($p['store']['name'] ?? 'Unknown store') ?></span>
          </div>
          <h3 class="product-name"><?= e($p['name']) ?></h3>
          <div class="product-price-row">
            <div class="product-price">
              <strong><?= e(format_money($p['currentPrice'], $p['currency'])) ?></strong>
              <?php if ($p['originalPrice'] !== null && $p['currentPrice'] !== null && $p['originalPrice'] > $p['currentPrice']): ?>
                <s><?= e(format_money($p['originalPrice'], $p['currency'])) ?></s>
              <?php endif; ?>
              <?php if (!empty($p['discountPercent'])): ?>
                <div class="product-discount">-<?= e($p['discountPercent']) ?>%</div>
              <?php endif; ?>
            </div>
            <div class="status-badge status-<?= strtolower(str_replace('_', '-', $p['status'])) === 'to-consider' ? 'consider' : (strtolower(str_replace('_', '-', $p['status'])) === 'to-buy' ? 'tobuy' : strtolower(str_replace('_', '-', $p['status']))) ?>">
              <?php $m = status_meta($p['status']); ?>
              <span class="dot <?= e($m['dot']) ?>"></span><?= e($m['label']) ?>
            </div>
          </div>
          <div class="product-foot">
            <div class="product-foot-left">
              <?php if ($p['availability']): ?>
                <?php
                $av = strtolower($p['availability']);
                $avcls = str_contains($av,'in stock') ? 'availability-in' : (str_contains($av,'out of stock') || str_contains($av,'sold') || str_contains($av,'discontinued') ? 'availability-out' : (str_contains($av,'pre-order') || str_contains($av,'back order') || str_contains($av,'limited') ? 'availability-pre' : 'availability-unknown'));
                ?>
                <span class="availability <?= e($avcls) ?>"><?= icon('check') ?><?= e($p['availability']) ?></span>
              <?php else: ?>
                <span class="no-meta"><?= icon('image-off') ?> <?= $p['imageUrl'] ? 'No availability data' : 'No image' ?></span>
              <?php endif; ?>
            </div>
            <a class="store-link" href="<?= e($p['url']) ?>" target="_blank" rel="noreferrer"><?= icon('external-link') ?> Store</a>
          </div>
        </div>
      </article>
    <?php endforeach; ?>
  </div>

  <div class="pagination">
    <p>Page <strong><?= e($pagination['page']) ?></strong> of <strong><?= e($pagination['totalPages']) ?></strong></p>
    <div class="pagination-controls">
      <?php if ($pagination['page'] > 1): ?>
        <?php $prevQ = http_build_query(array_merge($_GET, ['page' => $pagination['page'] - 1])); ?>
        <a class="btn btn-outline btn-sm" href="<?= e(url('/products?' . $prevQ)) ?>">Previous</a>
      <?php endif; ?>
      <?php if ($pagination['page'] < $pagination['totalPages']): ?>
        <?php $nextQ = http_build_query(array_merge($_GET, ['page' => $pagination['page'] + 1])); ?>
        <a class="btn btn-outline btn-sm" href="<?= e(url('/products?' . $nextQ)) ?>">Next</a>
      <?php endif; ?>
    </div>
  </div>
<?php endif; ?>