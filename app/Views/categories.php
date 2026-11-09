<?php
$categories = $categories ?? [];
?>
<div class="page-header">
  <div>
    <div class="eyebrow">Organisation</div>
    <h1 class="page-title">Categories</h1>
    <p class="page-desc">A quiet structure for everything you save.</p>
  </div>
  <div class="page-actions">
    <button class="btn btn-sm" type="button" id="newCategoryBtn"><?= icon('plus') ?> New category</button>
  </div>
</div>

<?php
$totalProducts = array_sum(array_map(fn($c) => $c['productCount'], $categories));
$totalValue = array_sum(array_map(fn($c) => $c['totalValue'], $categories));
?>
<div class="summary-grid">
  <div class="card summary-fact">
    <p>Categories</p>
    <p><?= e(count($categories)) ?></p>
    <p>In your vault</p>
  </div>
  <div class="card summary-fact">
    <p>Categorised products</p>
    <p><?= e($totalProducts) ?></p>
    <p>Across all categories</p>
  </div>
  <div class="card summary-fact">
    <p>Categorised value</p>
    <p><?= e(format_compact_money($totalValue, $settings['currency'] ?? 'PLN')) ?></p>
    <p>Estimated</p>
  </div>
</div>

<?php if (empty($categories)): ?>
  <div class="empty-state">
    <div class="empty-icon"><?= icon('tags') ?></div>
    <h3>No categories yet</h3>
    <p>Create your first category.</p>
  </div>
<?php else: ?>
  <div class="category-grid">
    <?php foreach ($categories as $c): ?>
      <div class="card category-card" data-id="<?= e($c['id']) ?>">
        <div class="category-top">
          <a class="category-link" href="<?= e(url('/products?categoryId=' . urlencode($c['id']))) ?>">
            <div class="category-icon" style="background:<?= e($c['color']) ?>22;color:<?= e($c['color']) ?>"><?= icon(lucide_name($c['icon'])) ?></div>
            <div>
              <div class="category-name-row">
                <span class="category-name"><?= e($c['name']) ?></span>
                <?php if ($c['isDefault']): ?><span class="badge badge-muted">Default</span><?php endif; ?>
              </div>
              <div class="category-meta"><?= e($c['productCount']) ?> product<?= $c['productCount'] === 1 ? '' : 's' ?></div>
            </div>
          </a>
        </div>
        <div class="category-foot">
          <div>
            <div class="category-value-label">Value</div>
            <div class="category-value"><?= e(format_money($c['totalValue'], $settings['currency'] ?? 'PLN')) ?></div>
          </div>
          <a class="category-view" href="<?= e(url('/products?categoryId=' . urlencode($c['id']))) ?>">View products <?= icon('arrow-right') ?></a>
        </div>
        <?php
        $max = max(array_map(fn($x) => $x['productCount'], $categories)) ?: 1;
        $pct = round($c['productCount'] / $max * 100);
        ?>
        <div class="category-progress"><span style="width:<?= e($pct) ?>%;background:<?= e($c['color']) ?>"></span></div>
      </div>
    <?php endforeach; ?>
  </div>
<?php endif; ?>

<!-- Category modal -->
<div class="modal" id="categoryModal">
  <div class="modal-dialog">
    <div class="modal-header">
      <h2 id="catModalTitle">New category</h2>
      <p id="catModalDesc">Pick a name, a soft accent colour and an icon.</p>
    </div>
    <div class="modal-body">
      <div class="field">
        <label class="label" for="catName">Name</label>
        <input class="input" id="catName" type="text">
      </div>
      <div class="field mt-3">
        <label class="label">Colour</label>
        <div class="swatches" id="catSwatches"></div>
      </div>
      <div class="field mt-3">
        <label class="label">Icon</label>
        <div class="icon-picker" id="catIcons"></div>
      </div>
      <input type="hidden" id="catId">
      <input type="hidden" id="catColor" value="#D9A3B0">
      <input type="hidden" id="catIcon" value="Tag">
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline btn-sm" type="button" id="catCancel">Cancel</button>
      <button class="btn btn-sm" type="button" id="catSave">Save</button>
    </div>
  </div>
</div>